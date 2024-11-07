from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Lobby, Game
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.contrib.auth.models import AnonymousUser
import asyncio
import random
from asyncio import Lock
from django.utils import timezone

import logging
logger = logging.getLogger('game_debug')
class LobbyConsumer(AsyncJsonWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.game_in_progress = False
        self.left_paddle_y = 250
        self.right_paddle_y = 250
        self.left_paddle_speed = 0
        self.right_paddle_speed = 0
        self.game_lock = Lock()
        self.game_manager_channel = None  # Initialize game manager channel
        self.current_round = 1
        self.rounds = []
        self.round_start_time = None
        
    async def start_game(self):
        if self.game_in_progress:
            return  # Prevent starting a new game if one is already in progress

        # Initialize game state variables
        self.game_in_progress = True
        self.left_paddle_y = 250
        self.right_paddle_y = 250
        self.ball_x = 500
        self.ball_y = 250
        self.ball_direction_x = 1
        self.ball_direction_y = 0.5
        self.ball_speed = 5
        self.left_score = 0
        self.right_score = 0
        self.current_round = 1
        self.round_start_time = timezone.now()

        # Get settings from lobby
        self.max_rounds = self.lobby.max_rounds
        self.round_score_limit = self.lobby.round_score_limit

        # Initialize rounds data
        self.rounds = []

        # Create a new Game instance
        await self.create_new_game_instance()

        # Notify players that the game has started
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "game_started"}
        )
        
        await self.channel_layer.group_send(
        self.room_group_name,
        {
            "type": "set_game_manager",
            "channel_name": self.channel_name,
        }
    )

        # Start the game loop
        self.game_loop_task = asyncio.create_task(self.game_loop())
        
    @database_sync_to_async
    def create_new_game_instance(self):
        self.game = Game.objects.create(
            player1=self.host,
            player2=self.guest,
            game_mode=Game.ONLINE_PVP,
            start_time=timezone.now(),
            is_completed=False,
            moves_log=[],
            rounds=[],
            player1_id=self.host.id,
        )

    async def set_game_manager(self, event):
        # Only set the game_manager_channel if the current consumer is not the host
        if not await self.is_user_host():
            self.game_manager_channel = event["channel_name"]
            logger.debug(f"Set game_manager_channel for guest: {self.game_manager_channel}")
        
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.lobby = await self.get_lobby(self.room_id)
        self.room_group_name = f'lobby_{self.room_id}'
        self.user = self.scope['user']

        # Set self.host and self.guest from the lobby
        self.host = await self.get_lobby_host()
        self.guest = await self.get_lobby_guest()

        # Check if the user is authenticated
        if isinstance(self.user, AnonymousUser):
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        if await self.is_user_host():
            self.game_manager_channel = self.channel_name
        else:
            # For guests, the game manager channel should have been set via 'set_game_manager'
            pass

        # Add the user as the guest if applicable and broadcast updated state
        if await self.add_guest_if_applicable():
            # Update self.guest since a new guest has been added
            self.guest = self.lobby.guest
            await self.broadcast_lobby_state()  # Broadcast if guest is added

        # Always send the initial state of the lobby to the connecting user
        await self.send_initial_state()  # Send the initial state to connecting user only

        # Ensure the state is broadcast to all members regardless of guest addition
        await self.broadcast_lobby_state()

    @database_sync_to_async
    def get_lobby(self, room_id):
        return Lobby.objects.select_related('host', 'guest').get(room_id=room_id)
    
    @database_sync_to_async
    def get_lobby_host(self):
        return self.lobby.host

    @database_sync_to_async
    def get_lobby_guest(self):
        return self.lobby.guest

    async def disconnect(self, close_code):
        # Remove the user from the group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        self.game_in_progress = False  # Stop the game loop

        # Determine if the disconnecting user is the host or the guest
        if await self.is_user_host():
            # If the host disconnects, delete the lobby and notify the guest
            await self.delete_lobby()
            alert_message = "The host has left the game. The game has been ended."
            user_role = "host"
        else:
            # If the guest disconnects, remove them from the lobby and notify the host
            await self.remove_guest()
            alert_message = "The guest has left the game. Waiting for a new player to join."
            user_role = "guest"

        # Broadcast an alert to remaining players
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "alert",
                "message": alert_message,
                "user_role": user_role
            }
        )
        
    async def alert(self, event):
        await self.send_json({
            "type": "alert",
            "message": event["message"],
            "user_role": event["user_role"]  # Send the user role along with the message
        })

    async def receive_json(self, content):
        action = content.get("action")
        if action == "set_ready":
            is_ready = content.get("is_ready", False)
            user_id = content.get("user_id")

            await self.update_ready_status(is_ready, user_id)
            await self.broadcast_lobby_state()
        if action == "start_game":
            await self.start_game()

        elif action in ["keydown", "keyup"]:
            await self.handle_key_event(action, content)
                
    async def handle_key_event(self, action, content):
        key = content.get("key")
        user_id = content.get("user_id")
        max_speed = 10
        
        # Determine speed based on keydown/keyup
        if action == "keydown":
            if key == "KeyW":
                speed = -max_speed
            elif key == "KeyS":
                speed = max_speed
            else:
                return  # Unrecognized key
        elif action == "keyup":
            speed = 0  # Reset speed on keyup
        else:
            return  # Unrecognized action

        # Send paddle speed update to the game manager
        if self.game_manager_channel:
            await self.channel_layer.send(
                self.game_manager_channel,
                {
                    "type": "update_paddle_speed",
                    "user_id": user_id,
                    "speed": speed,
                }
            )
        else:
            logger.warning("Game manager channel not set. Cannot send paddle speed update.")

    async def update_paddle_speed(self, event):
        user_id = event["user_id"]
        speed = event["speed"]
        async with self.game_lock:
            if await self.is_user_host_id(user_id):
                self.left_paddle_speed = speed
            else:
                self.right_paddle_speed = speed
                
    async def game_loop(self):
        while self.game_in_progress:
            await self.game_tick()
            await asyncio.sleep(1 / 60)

    def update_paddle_position(self, paddle, speed):
        if paddle == "left":
            self.left_paddle_y = max(0, min(self.left_paddle_y + speed, 500 - 60))
        elif paddle == "right":
            self.right_paddle_y = max(0, min(self.right_paddle_y + speed, 500 - 60))
            
    async def game_tick(self):
        async with self.game_lock:

            # Update paddle positions
            self.update_paddle_position("left", self.left_paddle_speed)
            self.update_paddle_position("right", self.right_paddle_speed)

            # Update ball position
            self.ball_x += self.ball_direction_x * self.ball_speed
            self.ball_y += self.ball_direction_y * self.ball_speed

            # Handle collisions with top/bottom walls
            if self.ball_y <= 0 or self.ball_y >= 500:
                self.ball_direction_y *= -1

            # Paddle collision handling
            if self.ball_x <= 10 and self.left_paddle_y < self.ball_y < self.left_paddle_y + 60:
                self.ball_direction_x *= -1
            elif self.ball_x >= 990 and self.right_paddle_y < self.ball_y < self.right_paddle_y + 60:
                self.ball_direction_x *= -1

            # Scoring logic
            scoring_player = None
            if self.ball_x <= 0:
                self.right_score += 1
                scoring_player = 'right'
                await self.reset_ball()
            elif self.ball_x >= 1000:
                self.left_score += 1
                scoring_player = 'left'
                await self.reset_ball()

            # **Add this block to check for round completion**
            if self.left_score >= self.round_score_limit or self.right_score >= self.round_score_limit:
                await self.complete_round()
                return  # Exit the game tick to prevent further processing until the next loop

            # Send game state to clients
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "game_state",
                    "leftScore": self.left_score,
                    "rightScore": self.right_score,
                    "ball_x": self.ball_x,
                    "ball_y": self.ball_y,
                    "left_paddle_y": self.left_paddle_y,
                    "right_paddle_y": self.right_paddle_y,
                    "left_speed": self.left_paddle_speed,
                    "right_speed": self.right_paddle_speed,
                }
            )
        
        
                
    async def complete_round(self):
        print("Round completed")
        # Determine round winner
        if self.left_score > self.right_score:
            round_winner = self.game.player1.username
        elif self.right_score > self.left_score:
            round_winner = self.game.player2.username
        else:
            round_winner = "Tie"

        # Record round details
        round_data = {
            'round_number': self.current_round,
            'start_time': self.round_start_time.isoformat(),
            'end_time': timezone.now().isoformat(),
            'score_player1': self.left_score,
            'score_player2': self.right_score,
            'winner': round_winner
        }

        await self.add_round_to_game(round_data)

        # Notify clients about round completion
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "round_completed",
                "round_data": round_data
            }
        )

        # Increment current_round after notifying clients
        self.current_round += 1

        # Check if the game should end
        if self.current_round > self.max_rounds:
            await self.end_game()
            return  # Exit the game tick to prevent further processing until the next loop

        # Reset scores for next round
        self.left_score = 0
        self.right_score = 0
        self.round_start_time = timezone.now()  # Reset round start time

        
    async def round_completed(self, event):
        # This method is called when a 'round_completed' event is received
        await self.send_json({
            "type": "round_completed",
            "round_data": event["round_data"]
        })

    async def game_ended(self, event):
        # This method is called when a 'game_ended' event is received
        await self.send_json({
            "type": "game_ended",
            "winner": event["winner"]
        })
            
    async def add_round_to_game(self, round_data):
        self.rounds.append(round_data)
        await database_sync_to_async(self._save_rounds_to_game)()

    def _save_rounds_to_game(self):
        self.game.rounds = self.rounds
        self.game.save()   
        
    async def end_game(self):
        print("Game ended")
        self.game_in_progress = False

        # Determine game winner based on rounds won
        player1_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player1.username)
        player2_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player2.username)

        if player1_round_wins > player2_round_wins:
            winner = self.game.player1
        elif player2_round_wins > player1_round_wins:
            winner = self.game.player2
        else:
            winner = None  # Tie

        await self.finalize_game(winner)

        # Notify players that the game has ended
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "game_ended",
                "winner": winner.username if winner else "Tie"
            }
        )

        # Give some time for messages to be sent
        await asyncio.sleep(0.1)

        # Cancel the game loop task
        if hasattr(self, 'game_loop_task'):
            self.game_loop_task.cancel()
            
    @database_sync_to_async
    def get_player_usernames(self):
        player1_username = self.game.player1.username
        player2_username = self.game.player2.username
        return player1_username, player2_username
            
    @database_sync_to_async
    def finalize_game(self, winner):
        self.game.end_time = timezone.now()
        self.game.duration = (self.game.end_time - self.game.start_time).total_seconds()
        self.game.winner = winner
        self.game.is_completed = True
        self.game.save()

    async def reset_ball(self):
        # Reset ball position to the center
        self.ball_x = 500
        self.ball_y = 250
        
        # Randomly set the ball direction to left or right
        self.ball_direction_x = -1 if random.random() < 0.5 else 1
        
        # Set the ball direction Y to a small random value to avoid straight horizontal movement
        self.ball_direction_y = (random.random() * 2 - 1) * 0.5  # Random value between -0.5 and 0.5
        
        # Increase ball speed by 1.05x each reset, capping at 100
        self.ball_speed = min(self.ball_speed * 1.05, 100) if hasattr(self, 'ball_speed') else 5


    async def game_started(self, event):
        await self.send_json({"type": "game_started"})

    async def game_state(self, event):
        await self.send_json(event)

    async def ready_status(self, event):
        await self.send_json({
            "type": "ready_status",
            "isHostReady": event["is_host_ready"],
            "isGuestReady": event["is_guest_ready"],
            "allReady": event["all_ready"],
            "host": event["host_name"],
            "guest": event["guest_name"],
        })

    async def send_initial_state(self):
        lobby_state = await self.get_lobby_state()
        await self.send_json({
            "type": "initial_state",
            **lobby_state
        })

    async def initial_state(self, event):
        await self.send_json({
            "type": "initial_state",
            **event
        })

    async def lobby_closed(self, event):
        await self.send_json({
            "type": "lobby_closed",
            "message": event["message"]
        })

    @database_sync_to_async
    def get_lobby_state(self):
        lobby = Lobby.objects.get(room_id=self.room_id)
        return lobby.get_lobby_state()

    @database_sync_to_async
    def update_ready_status(self, is_ready, user_id):
        try:
            with transaction.atomic():
                lobby = Lobby.objects.select_for_update().get(room_id=self.room_id)
                if user_id == lobby.host.id:
                    lobby.is_host_ready = is_ready
                elif lobby.guest and user_id == lobby.guest.id:
                    lobby.is_guest_ready = is_ready
                else:
                    raise PermissionDenied("User not part of this lobby.")

                lobby.save()
                return {
                    "is_host_ready": lobby.is_host_ready,
                    "is_guest_ready": lobby.is_guest_ready,
                    "all_ready": lobby.all_ready()
                }

        except ObjectDoesNotExist:
            raise ObjectDoesNotExist(f"Lobby with room_id {self.room_id} does not exist.")
        except PermissionDenied as e:
            raise PermissionDenied(str(e))

    async def broadcast_lobby_state(self):
        lobby_state = await self.get_lobby_state()
        try:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "ready_status",
                    **lobby_state
                }
            )
        except Exception as e:
            # Improved error logging
            print(f"Error broadcasting lobby state in room {self.room_group_name}: {e}")

    async def add_guest_if_applicable(self):
        """Add the user as a guest if they are joining an empty guest slot and return True if the guest was added."""
        if await self.is_user_eligible_as_guest():
            await self.set_guest()
            return True
        return False

    @database_sync_to_async
    def is_user_eligible_as_guest(self):
        try:
            lobby = Lobby.objects.get(room_id=self.room_id)
            return lobby.guest is None and self.user != lobby.host
        except Lobby.DoesNotExist:
            return False

    @database_sync_to_async
    def set_guest(self):
        lobby = Lobby.objects.get(room_id=self.room_id)
        lobby.guest = self.user
        lobby.save()
        self.lobby = lobby  # Update self.lobby to reflect changes
        self.guest = lobby.guest

    @database_sync_to_async
    def is_user_host(self):
        """Check if the disconnecting user is the host."""
        lobby = Lobby.objects.get(room_id=self.room_id)
        return self.user == lobby.host
    
    @database_sync_to_async
    def is_user_host_id(self, user_id):
        lobby = Lobby.objects.get(room_id=self.room_id)
        return user_id == lobby.host_id  # Use host_id to avoid fetching the host object

    @database_sync_to_async
    def delete_lobby(self):
        """Delete the lobby if the host disconnects."""
        Lobby.objects.filter(room_id=self.room_id).delete()

    @database_sync_to_async
    def remove_guest(self):
        """Remove the guest from the lobby if the guest disconnects."""
        lobby = Lobby.objects.get(room_id=self.room_id)
        lobby.guest = None
        lobby.is_guest_ready = False
        lobby.save()
