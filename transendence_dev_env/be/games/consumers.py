from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Lobby, ChaosLobby, ArenaLobby, Game, TournamentLobby, OnlineTournament
from .services.tournament_lobby_service import TournamentLobbyService
from django.contrib.auth.models import User 
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.contrib.auth.models import AnonymousUser
import asyncio
import random
import math
import json
from asyncio import Lock
from django.utils import timezone
from threading import Timer

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
        await self.update_host_and_guest()
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
        await self.set_game_status(Game.RUNNING)

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

    async def update_host_and_guest(self):
        self.lobby = await self.get_lobby(self.room_id)
        self.host = await self.get_lobby_host()
        self.guest = await self.get_lobby_guest()

    @database_sync_to_async
    def create_new_game_instance(self):
        logger.debug(f"Creating new game instance for players: {self.host} and {self.guest}")
        logger.debug(f"Game mode: {Game.ONLINE_PVP}")
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

    @database_sync_to_async
    def clear_existing_user_rooms(self):
        """Removes the user from any existing rooms and deletes any rooms they created, except the one they are joining."""
        # Remove the user as a guest from any other lobbies, excluding the current one
        Lobby.objects.filter(guest=self.user).exclude(room_id=self.room_id).update(guest=None, is_guest_ready=False)
        
        # Delete any lobbies where the user is the host, excluding the current one
        Lobby.objects.filter(host=self.user).exclude(room_id=self.room_id).delete()

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
        
        # Ensure the user is only in one room by clearing existing associations
        await self.clear_existing_user_rooms()
        
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

        # Stop the game if it’s running by canceling the game loop task
        if hasattr(self, 'game_loop_task') and not self.game_loop_task.done():
            self.game_loop_task.cancel()
            self.game_in_progress = False  # Update the game status

        # Determine if the disconnecting user is the host or the guest
        if await self.is_user_host():
            # If the host disconnects, handle based on game state
            if self.game_in_progress:
                # Notify the guest, end the game, and delete the lobby
                await self.set_game_status(Game.CANCELED_BY_HOST)
                await self.terminate_game_and_notify("The host has left the game. Game canceled.", "host")
            else:
                # If the game is not in progress, notify the guest and delete the lobby
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "alert",
                        "message": "The host has left the lobby. Game has been canceled.",
                        "user_role": "host"
                    }
                )
                await self.delete_lobby()
        else:
            # If the guest disconnects, handle accordingly based on game state
            if self.game_in_progress:
                # Notify the host, cancel the game, and delete the lobby
                await self.set_game_status(Game.CANCELED_BY_GUEST)
                await self.terminate_game_and_notify("The guest has left the game. Game canceled.", "guest")
            else:
                # If the guest leaves before the game starts, simply remove the guest from the lobby
                await self.remove_guest()
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "alert",
                        "message": "The guest has left the lobby. Waiting for a new player to join.",
                        "user_role": "guest"
                    }
                )

    async def terminate_game_and_notify(self, message, user_role):
        """Ends the game, notifies the players, and deletes the lobby."""
        await self.finalize_game(None, Game.CANCELED_BY_GUEST if user_role == "guest" else Game.CANCELED_BY_HOST)

        # Notify remaining players about game cancellation
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "alert",
                "message": message,
                "user_role": user_role
            }
        )

        # Cancel the game loop if running
        if hasattr(self, 'game_loop_task'):
            self.game_loop_task.cancel()

        # Delete the lobby
        await self.delete_lobby()

        
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

    @database_sync_to_async
    def set_game_status(self, status):
        """Sets the status of the current game."""
        self.game.status = status
        self.game.save()
        
    async def calculate_xp_gain(self, game, player, is_winner=False):
        # Set a default duration to handle None values
        game_duration = game.duration if game.duration is not None else 0

        # Base XP values
        base_xp = 50  # Base XP for winning a game
        level_bonus = 1.5 * await self.get_player_level(player)  # Use async method to get player level

        # Calculate duration-based XP, with diminishing returns
        if game_duration < 300:  # Short game
            duration_xp = game_duration * 0.5  # 0.5 XP per second for shorter games
        elif game_duration < 1200:  # Medium game
            duration_xp = game_duration * 0.3  # 0.3 XP per second for medium length games
        else:  # Long game
            duration_xp = min(400 + (game_duration - 1200) * 0.1, 600)  # Cap XP for long games

        # Score difference multiplier for higher XP based on performance
        score_difference = abs(game.score_player1 - game.score_player2)
        performance_multiplier = 1 + min(score_difference / 100, 0.5)  # Up to +50% XP based on score gap

        # Game mode multiplier: more challenging modes award more XP
        if game.game_mode == Game.PVE:
            mode_multiplier = 0.7 if not is_winner else 1.0  # PvE easier, give less XP if lost
        elif game.game_mode == Game.LOCAL_PVP:
            mode_multiplier = 1.0 if not is_winner else 1.1  # Balanced mode, slight bonus for win
        else:
            mode_multiplier = 1.1 if not is_winner else 1.3  # Online PvP, higher reward for higher challenge

        # Apply base, duration, level, performance, and mode multipliers
        xp_gain = (base_xp + duration_xp + level_bonus) * performance_multiplier * mode_multiplier

        # Additional XP for winning, varies by game mode
        if is_winner:
            xp_gain += 50 if game.game_mode == Game.PVE else 75  # Higher bonus for PvP games

        return int(xp_gain)
        
    async def end_game(self):
        logger.info(f"Game data: {self.game}")
        self.game_in_progress = False
        # Determine game winner based on rounds won
        try:
            logger.debug(f"Player 1: {self.game.player1}, Player 2: {self.game.player2}")
            player1_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player1.username)
            player2_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player2.username)
            logger.info(f"Player 1 round wins: {player1_round_wins}, Player 2 round wins: {player2_round_wins}")
            logger.info(f"Round data: {self.rounds}")
            self.game.score_player1 = player1_round_wins
            self.game.score_player2 = player2_round_wins
        except Exception as e:
            # ERROR 2024-11-09 17:58:43,417 consumers Error determining game winner: 'NoneType' object has no attribute 'username'
            logger.error(f"Error determining game winner in end_game: {e}")
            player1_round_wins = 0
            player2_round_wins = 0
            
        if player1_round_wins > player2_round_wins:
            winner, loser = self.game.player1, self.game.player2
        elif player2_round_wins > player1_round_wins:
            winner, loser = self.game.player2, self.game.player1
        else:
            winner, loser = None, None  # Tie

        logger.info(f"Game winner: {winner}")

        # Calculate XP gain
        winner_xp = await self.calculate_xp_gain(self.game, winner, is_winner=True) if winner else 0
        loser_xp = max(10, await self.calculate_xp_gain(self.game, loser, is_winner=False) // 4) if loser else 0

        await self.finalize_game(winner, Game.FINISHED, winner_xp, loser_xp)

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
    def get_player_level(self, player):
        return player.profile.level   
    
    @database_sync_to_async
    def get_player_usernames(self):
        player1_username = self.game.player1.username
        player2_username = self.game.player2.username
        return player1_username, player2_username
            
    @database_sync_to_async
    def finalize_game(self, winner, status, winner_xp, loser_xp):
        self.game.end_time = timezone.now()
        self.game.duration = (self.game.end_time - self.game.start_time).total_seconds()
        self.game.winner = winner
        self.game.is_completed = True
        self.game.status = status
        
        # Save the game instance
        self.game.save()

        # Apply XP to profiles if winner and loser are actual User instances
        if isinstance(winner, User):
            winner.profile.add_xp(winner_xp)
        if isinstance(self.game.player2, User) and self.game.player2 != winner:
            self.game.player2.profile.add_xp(loser_xp)

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

class ChaosLobbyConsumer(AsyncJsonWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.game_in_progress = False
        self.left_paddle_y = 250
        self.right_paddle_y = 250
        self.left_paddle_speed = 0
        self.right_paddle_speed = 0
        self.paddle_size_modifier = 1
        self.ball_size_modifier = 1
        self.ball_speed_modifier = 1
        self.active_power_ups = []
        self.expire_power_ups = []
        self.POWER_UPS = ["enlargePaddle", "shrinkPaddle", "slowBall", "fastBall", "teleportBall", "shrinkBall", "growBall"]
        self.game_lock = Lock()
        self.game_manager_channel = None  # Initialize game manager channel
        self.current_round = 1
        self.rounds = []
        self.round_start_time = None

    async def start_game(self):
        if self.game_in_progress:
            return  # Prevent starting a new game if one is already in progress
        await self.update_host_and_guest()
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
        self.powerup_spawn_rate = self.lobby.powerup_spawn_rate

        # Initialize rounds data
        self.rounds = []
        # Create a new Game instance
        await self.create_new_game_instance()
        await self.set_game_status(Game.RUNNING)

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


    async def update_host_and_guest(self):
        self.lobby = await self.get_lobby(self.room_id)
        self.host = await self.get_lobby_host()
        self.guest = await self.get_lobby_guest()

    @database_sync_to_async
    def create_new_game_instance(self):
        logger.debug(f"Creating new game instance for players: {self.host} and {self.guest}")
        logger.debug(f"Game mode: {Game.ONLINE_CHAOS_PVP}")
        self.game = Game.objects.create(
            player1=self.host,
            player2=self.guest,
            game_mode=Game.ONLINE_CHAOS_PVP,
            start_time=timezone.now(),
            is_completed=False,
            moves_log=[],
            rounds=[],
            player1_id=self.host.id,
        )

    @database_sync_to_async
    def clear_existing_user_rooms(self):
        """Removes the user from any existing rooms and deletes any rooms they created, except the one they are joining."""
        # Remove the user as a guest from any other lobbies, excluding the current one
        ChaosLobby.objects.filter(guest=self.user).exclude(room_id=self.room_id).update(guest=None, is_guest_ready=False)

        # Delete any lobbies where the user is the host, excluding the current one
        ChaosLobby.objects.filter(host=self.user).exclude(room_id=self.room_id).delete()

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

        # Ensure the user is only in one room by clearing existing associations
        await self.clear_existing_user_rooms()
        
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
        return ChaosLobby.objects.select_related('host', 'guest').get(room_id=room_id)

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

        # Stop the game if it’s running by canceling the game loop task
        if hasattr(self, 'game_loop_task') and not self.game_loop_task.done():
            self.game_loop_task.cancel()
            self.game_in_progress = False  # Update the game status

        # Determine if the disconnecting user is the host or the guest
        if await self.is_user_host():
            # If the host disconnects, handle based on game state
            if self.game_in_progress:
                # Notify the guest, end the game, and delete the lobby
                await self.set_game_status(Game.CANCELED_BY_HOST)
                await self.terminate_game_and_notify("The host has left the game. Game canceled.", "host")
            else:
                # If the game is not in progress, notify the guest and delete the lobby
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "alert",
                        "message": "The host has left the lobby. Game has been canceled.",
                        "user_role": "host"
                    }
                )
                await self.delete_lobby()
        else:
            # If the guest disconnects, handle accordingly based on game state
            if self.game_in_progress:
                # Notify the host, cancel the game, and delete the lobby
                await self.set_game_status(Game.CANCELED_BY_GUEST)
                await self.terminate_game_and_notify("The guest has left the game. Game canceled.", "guest")
            else:
                # If the guest leaves before the game starts, simply remove the guest from the lobby
                await self.remove_guest()
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "alert",
                        "message": "The guest has left the lobby. Waiting for a new player to join.",
                        "user_role": "guest"
                    }
                )

    async def terminate_game_and_notify(self, message, user_role):
        """Ends the game, notifies the players, and deletes the lobby."""
        await self.finalize_game(None, Game.CANCELED_BY_GUEST if user_role == "guest" else Game.CANCELED_BY_HOST)

        # Notify remaining players about game cancellation
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "alert",
                "message": message,
                "user_role": user_role
            }
        )

        # Cancel the game loop if running
        if hasattr(self, 'game_loop_task'):
            self.game_loop_task.cancel()

        # Delete the lobby
        await self.delete_lobby()

        
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
        self.tick_count = 0
        spawn_interval = int(60 * self.powerup_spawn_rate)
        while self.game_in_progress:
            await self.game_tick()
            self.tick_count += 1
            if (self.tick_count % (spawn_interval) == 0):
                self.generate_power_up()
            if (self.tick_count % 60 == 0):
                self.check_power_up_expiration()
            await asyncio.sleep(1 / 60)

    def update_paddle_position(self, paddle, speed):
        if paddle == "left":
            self.left_paddle_y = max(0, min(self.left_paddle_y + speed, 500 - (60 * self.paddle_size_modifier)))
        elif paddle == "right":
            self.right_paddle_y = max(0, min(self.right_paddle_y + speed, 500 - (60 * self.paddle_size_modifier)))

    def enlarge_paddle(self):
        self.paddle_size_modifier *= 1.5
        self.expire_power_ups.append({"type": "enlargePaddle", "time_left": 5})

    def shrink_paddle(self):
        self.paddle_size_modifier *= 0.5
        self.expire_power_ups.append({"type": "shrinkPaddle", "time_left": 5})

    def shrink_ball(self):
        self.ball_size_modifier *= 0.5
        self.expire_power_ups.append({"type": "shrinkBall", "time_left": 5})

    def grow_ball(self):
        self.ball_size_modifier *= 1.5
        self.expire_power_ups.append({"type": "growBall", "time_left": 5})

    def slow_ball(self):
        self.ball_speed_modifier *= 0.5
        self.expire_power_ups.append({"type": "slowBall", "time_left": 5})

    def fast_ball(self):
        self.ball_speed_modifier *= 1.5
        self.expire_power_ups.append({"type": "fastBall", "time_left": 5})

    def teleport_ball(self):
        self.ball_x = random.randint(int(30 * self.ball_size_modifier), int(1000 - 30 * self.ball_size_modifier))
        self.ball_y = random.randint(int(30 * self.ball_size_modifier), int(500 - 30 * self.ball_size_modifier))

    def generate_power_up(self):
        power_up = random.choice(self.POWER_UPS)
        power_up_x = random.randint(25, 975)
        power_up_y = random.randint(25, 475)
        self.active_power_ups.append({"x": power_up_x, "y": power_up_y, "type": power_up})

    def activate_power_up(self, power_up):
        if (power_up == "enlargePaddle"):
            self.enlarge_paddle()
        elif (power_up == "shrinkPaddle"):
            self.shrink_paddle()
        elif (power_up == "slowBall"):
            self.slow_ball()
        elif (power_up == "fastBall"):
            self.fast_ball()
        elif (power_up == "teleportBall"):
            self.teleport_ball()
        elif (power_up == "shrinkBall"):
            self.shrink_ball()
        elif (power_up == "growBall"):
            self.grow_ball()

    def check_power_up_expiration(self):
        for power_up in list(self.expire_power_ups):
            power_up['time_left'] -= 1
            if power_up['time_left'] <= 0:
                if power_up['type'] == "enlargePaddle":
                    self.paddle_size_modifier *= 0.5
                elif power_up['type'] == "shrinkPaddle":
                    self.paddle_size_modifier *= 1.5
                elif power_up['type'] == "slowBall":
                    self.ball_speed_modifier *= 1.5
                elif power_up['type'] == "fastBall":
                    self.ball_speed_modifier *= 0.5
                elif power_up['type'] == "shrinkBall":
                    self.ball_size_modifier *= 1.5
                elif power_up['type'] == "growBall":
                    self.ball_size_modifier *= 0.5
                self.expire_power_ups.remove(power_up)

    def enforce_modifier_bounds(self):
        self.paddle_size_modifier = max(0.25, min(self.paddle_size_modifier, 3.375))
        self.ball_size_modifier = max(0.25, min(self.ball_size_modifier, 3.375))
        self.ball_speed_modifier = max(0.25, min(self.ball_speed_modifier, 3.375))

    async def game_tick(self):
        async with self.game_lock:

            # Update paddle positions
            self.update_paddle_position("left", self.left_paddle_speed)
            self.update_paddle_position("right", self.right_paddle_speed)

            # Update ball position
            self.ball_x += self.ball_direction_x * (self.ball_speed * self.ball_speed_modifier)
            self.ball_y += self.ball_direction_y * (self.ball_speed * self.ball_speed_modifier)

            # Handle collisions with top/bottom walls
            if self.ball_y - 15 * self.ball_size_modifier <= 0 or self.ball_y + 15 * self.ball_size_modifier >= 500:
                self.ball_direction_y *= -1

            # Paddle collision handling
            if self.ball_x - (15 * self.ball_size_modifier) <= 10 and self.left_paddle_y < self.ball_y < self.left_paddle_y + (60 * self.paddle_size_modifier):
                self.ball_direction_x *= -1
            elif self.ball_x + (15 * self.ball_size_modifier) >= 990 and self.right_paddle_y < self.ball_y < self.right_paddle_y + (60 * self.paddle_size_modifier):
                self.ball_direction_x *= -1

            # Power-up logic
            for power_up in list(self.active_power_ups):  # Use a copy to avoid modification during iteration
                power_up_x = power_up['x']
                power_up_y = power_up['y']
                power_up_type = power_up['type']
                distance_squared = (self.ball_x - power_up_x) ** 2 + (self.ball_y - power_up_y) ** 2
                radius_sum_squared = (15 + 15 * self.ball_size_modifier) ** 2
                if distance_squared < radius_sum_squared:
                    self.activate_power_up(power_up_type)
                    self.active_power_ups.remove(power_up)

            self.enforce_modifier_bounds()

            # Scoring logic
            scoring_player = None
            if self.ball_x - 15 * self.ball_size_modifier <= 0:
                self.right_score += 1
                scoring_player = 'right'
                await self.reset_ball()
            elif self.ball_x + 15 * self.ball_size_modifier >= 1000:
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
                    "paddle_size_modifier": self.paddle_size_modifier,
                    "ball_size_modifier": self.ball_size_modifier,
                    "left_speed": self.left_paddle_speed,
                    "right_speed": self.right_paddle_speed,
                    "active_power_ups": self.active_power_ups or [],
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

    @database_sync_to_async
    def set_game_status(self, status):
        """Sets the status of the current game."""
        self.game.status = status
        self.game.save()
        
    async def calculate_xp_gain(self, game, player, is_winner=False):
        # Set a default duration to handle None values
        game_duration = game.duration if game.duration is not None else 0

        # Base XP values
        base_xp = 50  # Base XP for winning a game
        level_bonus = 1.5 * await self.get_player_level(player)  # Use async method to get player level

        # Calculate duration-based XP, with diminishing returns
        if game_duration < 300:  # Short game
            duration_xp = game_duration * 0.5  # 0.5 XP per second for shorter games
        elif game_duration < 1200:  # Medium game
            duration_xp = game_duration * 0.3  # 0.3 XP per second for medium length games
        else:  # Long game
            duration_xp = min(400 + (game_duration - 1200) * 0.1, 600)  # Cap XP for long games

        # Score difference multiplier for higher XP based on performance
        score_difference = abs(game.score_player1 - game.score_player2)
        performance_multiplier = 1 + min(score_difference / 100, 0.5)  # Up to +50% XP based on score gap

        # Game mode multiplier: more challenging modes award more XP
        if game.game_mode == Game.PVE:
            mode_multiplier = 0.7 if not is_winner else 1.0  # PvE easier, give less XP if lost
        elif game.game_mode == Game.LOCAL_PVP:
            mode_multiplier = 1.0 if not is_winner else 1.1  # Balanced mode, slight bonus for win
        else:
            mode_multiplier = 1.1 if not is_winner else 1.3  # Online PvP, higher reward for higher challenge

        # Apply base, duration, level, performance, and mode multipliers
        xp_gain = (base_xp + duration_xp + level_bonus) * performance_multiplier * mode_multiplier

        # Additional XP for winning, varies by game mode
        if is_winner:
            xp_gain += 50 if game.game_mode == Game.PVE else 75  # Higher bonus for PvP games

        return int(xp_gain)
        
    async def end_game(self):
        logger.info(f"Game data: {self.game}")
        self.game_in_progress = False
        # Determine game winner based on rounds won
        try:
            logger.debug(f"Player 1: {self.game.player1}, Player 2: {self.game.player2}")
            player1_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player1.username)
            player2_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player2.username)
            logger.info(f"Player 1 round wins: {player1_round_wins}, Player 2 round wins: {player2_round_wins}")
            logger.info(f"Round data: {self.rounds}")
            self.game.score_player1 = player1_round_wins
            self.game.score_player2 = player2_round_wins
        except Exception as e:
            # ERROR 2024-11-09 17:58:43,417 consumers Error determining game winner: 'NoneType' object has no attribute 'username'
            logger.error(f"Error determining game winner in end_game: {e}")
            player1_round_wins = 0
            player2_round_wins = 0
            
        if player1_round_wins > player2_round_wins:
            winner, loser = self.game.player1, self.game.player2
        elif player2_round_wins > player1_round_wins:
            winner, loser = self.game.player2, self.game.player1
        else:
            winner, loser = None, None  # Tie

        logger.info(f"Game winner: {winner}")

        # Calculate XP gain
        winner_xp = await self.calculate_xp_gain(self.game, winner, is_winner=True) if winner else 0
        loser_xp = max(10, await self.calculate_xp_gain(self.game, loser, is_winner=False) // 4) if loser else 0

        await self.finalize_game(winner, Game.FINISHED, winner_xp, loser_xp)

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
    def get_player_level(self, player):
        return player.profile.level   
    
    @database_sync_to_async
    def get_player_usernames(self):
        player1_username = self.game.player1.username
        player2_username = self.game.player2.username
        return player1_username, player2_username
            
    @database_sync_to_async
    def finalize_game(self, winner, status, winner_xp, loser_xp):
        self.game.end_time = timezone.now()
        self.game.duration = (self.game.end_time - self.game.start_time).total_seconds()
        self.game.winner = winner
        self.game.is_completed = True
        self.game.status = status
        
        # Save the game instance
        self.game.save()

        # Apply XP to profiles if winner and loser are actual User instances
        if isinstance(winner, User):
            winner.profile.add_xp(winner_xp)
        if isinstance(self.game.player2, User) and self.game.player2 != winner:
            self.game.player2.profile.add_xp(loser_xp)

    async def reset_ball(self):
        # Reset ball position to the center
        self.ball_x = 500
        self.ball_y = 250

        # Reset size and speed modifiers
        self.ball_speed_modifier = 1
        self.ball_size_modifier = 1
        self.paddle_size_modifier = 1

        # Clear active power-ups to prevent stacking between rounds
        self.expire_power_ups.clear()

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
        lobby = ChaosLobby.objects.get(room_id=self.room_id)
        return lobby.get_lobby_state()

    @database_sync_to_async
    def update_ready_status(self, is_ready, user_id):
        try:
            with transaction.atomic():
                lobby = ChaosLobby.objects.select_for_update().get(room_id=self.room_id)
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
            lobby = ChaosLobby.objects.get(room_id=self.room_id)
            return lobby.guest is None and self.user != lobby.host
        except ChaosLobby.DoesNotExist:
            return False

    @database_sync_to_async
    def set_guest(self):
        lobby = ChaosLobby.objects.get(room_id=self.room_id)
        lobby.guest = self.user
        lobby.save()
        self.lobby = lobby  # Update self.lobby to reflect changes
        self.guest = lobby.guest

    @database_sync_to_async
    def is_user_host(self):
        """Check if the disconnecting user is the host."""
        lobby = ChaosLobby.objects.get(room_id=self.room_id)
        return self.user == lobby.host
    
    @database_sync_to_async
    def is_user_host_id(self, user_id):
        lobby = ChaosLobby.objects.get(room_id=self.room_id)
        return user_id == lobby.host_id  # Use host_id to avoid fetching the host object

    @database_sync_to_async
    def delete_lobby(self):
        """Delete the lobby if the host disconnects."""
        ChaosLobby.objects.filter(room_id=self.room_id).delete()

    @database_sync_to_async
    def remove_guest(self):
        """Remove the guest from the lobby if the guest disconnects."""
        lobby = ChaosLobby.objects.get(room_id=self.room_id)
        lobby.guest = None
        lobby.is_guest_ready = False
        lobby.save()

class ArenaLobbyConsumer(AsyncJsonWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.game_in_progress = False

        self.left_paddle_y = 400
        self.right_paddle_y = 400
        self.top_paddle_x = 370
        self.bottom_paddle_x = 370

        self.left_paddle_speed = 0
        self.right_paddle_speed = 0
        self.top_paddle_speed = 0
        self.bottom_paddle_speed = 0

        self.game_lock = Lock()
        self.game_manager_channel = None  # Initialize game manager channel
        self.current_round = 1
        self.rounds = []
        self.round_start_time = None
        
    async def start_game(self):
        if self.game_in_progress:
            return  # Prevent starting a new game if one is already in progress
        await self.update_player_status()
        # Initialize game state variables
        self.game_in_progress = True

        self.last_touch = None
        self.left_paddle_y = 400
        self.right_paddle_y = 400
        self.top_paddle_x = 370
        self.bottom_paddle_x = 370

        self.ball_x = 400
        self.ball_y = 400
        self.ball_direction_x = 1
        self.ball_direction_y = 0.5
        self.ball_speed = 5

        self.left_score = 0
        self.right_score = 0
        self.top_score = 0
        self.bottom_score = 0

        self.current_round = 1
        self.round_start_time = timezone.now()

        # Get settings from lobby
        self.max_rounds = self.lobby.max_rounds
        self.round_score_limit = self.lobby.round_score_limit

        # Initialize rounds data
        self.rounds = []
        # Create a new Game instance
        await self.create_new_game_instance()
        await self.set_game_status(Game.RUNNING)

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

    async def update_player_status(self):
        self.lobby = await self.get_lobby(self.room_id)
        self.host = await self.get_lobby_host()
        self.player_two = await self.get_lobby_player_two()
        self.player_three = await self.get_lobby_player_three()
        self.player_four = await self.get_lobby_player_four()

    @database_sync_to_async
    def create_new_game_instance(self):
        logger.debug(f"Creating new game instance for players: {self.host}, {self.player_two}, {self.player_three}, {self.player_four}")
        logger.debug(f"Game mode: {Game.ONLINE_ARENA_PVP}")
        self.game = Game.objects.create(
            player1=self.host,
            player2=self.player_two,
            player3=self.player_three,
            player4=self.player_four,
            game_mode=Game.ONLINE_ARENA_PVP,
            start_time=timezone.now(),
            is_completed=False,
            moves_log=[],
            rounds=[],
            player1_id=self.host.id,
        )

    @database_sync_to_async
    def clear_existing_user_rooms(self):
        """Removes the user from any existing rooms and deletes any rooms they created, except the one they are joining."""
        # Remove the users as a guest from any other lobbies, excluding the current one
        ArenaLobby.objects.filter(player_two=self.user).exclude(room_id=self.room_id).update(player_two=None, is_player_two_ready=False)
        ArenaLobby.objects.filter(player_three=self.user).exclude(room_id=self.room_id).update(player_three=None, is_player_three_ready=False)
        ArenaLobby.objects.filter(player_four=self.user).exclude(room_id=self.room_id).update(player_four=None, is_player_four_ready=False)

        # Delete any lobbies where the user is the host, excluding the current one
        ArenaLobby.objects.filter(host=self.user).exclude(room_id=self.room_id).delete()

    async def set_game_manager(self, event):
        # Only set the game_manager_channel if the current consumer is not the host
        if not await self.is_user_host():
            self.game_manager_channel = event["channel_name"]
            logger.debug(f"Set game_manager_channel for player {self.user}: {self.game_manager_channel}")

    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.lobby = await self.get_lobby(self.room_id)
        self.room_group_name = f'lobby_{self.room_id}'
        self.user = self.scope['user']

        # Set user variables from the lobby
        self.host = self.lobby.player_one
        self.player_two = self.lobby.player_two
        self.player_three = self.lobby.player_three
        self.player_four = self.lobby.player_four

        # Ensure the user is only in one room by clearing existing associations
        # await self.clear_existing_user_rooms()
        
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
            await self.broadcast_lobby_state()  # Broadcast if guest is added

        # Always send the initial state of the lobby to the connecting user
        await self.send_initial_state()  # Send the initial state to connecting user only

        # Ensure the state is broadcast to all members regardless of guest addition
        await self.broadcast_lobby_state()

    @database_sync_to_async
    def get_lobby(self, room_id):
        return ArenaLobby.objects.select_related('player_one', 'player_two', 'player_three', 'player_four').get(room_id=room_id)

    @database_sync_to_async
    def get_lobby_host(self):
        return self.lobby.player_one

    @database_sync_to_async
    def get_lobby_player_two(self):
        return self.lobby.player_two

    @database_sync_to_async
    def get_lobby_player_three(self):
        return self.lobby.player_three

    @database_sync_to_async
    def get_lobby_player_four(self):
        return self.lobby.player_four

    async def disconnect(self, close_code):
        # Remove the user from the group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Stop the game if it’s running by canceling the game loop task
        if hasattr(self, 'game_loop_task') and not self.game_loop_task.done():
            self.game_loop_task.cancel()
            self.game_in_progress = False  # Update the game status

        # Determine if the disconnecting user is the host or the guest
        if await self.is_user_host():
            # If the host disconnects, handle based on game state
            if self.game_in_progress:
                # Notify the guest, end the game, and delete the lobby
                await self.set_game_status(Game.CANCELED_BY_HOST)
                await self.terminate_game_and_notify("The host has left the game. Game canceled.", "host")
            else:
                # If the game is not in progress, notify the guest and delete the lobby
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "alert",
                        "message": "The host has left the lobby. Game has been canceled.",
                        "user_role": "host"
                    }
                )
                await self.delete_lobby()
        else:
            # If the guest disconnects, handle accordingly based on game state
            if self.game_in_progress:
                # Notify the host, cancel the game, and delete the lobby
                await self.set_game_status(Game.CANCELED_BY_GUEST)
                await self.terminate_game_and_notify("The guest has left the game. Game canceled.", "guest")
            else:
                # If the guest leaves before the game starts, simply remove the guest from the lobby
                removed_user = await self.remove_guest()
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "alert",
                        "message": "The guest has left the lobby. Waiting for a new player to join.",
                        "user_role": "guest",
                        "user_slot": removed_user
                    }
                )

    async def terminate_game_and_notify(self, message, user_role):
        """Ends the game, notifies the players, and deletes the lobby."""
        await self.finalize_game(None, Game.CANCELED_BY_GUEST if user_role == "guest" else Game.CANCELED_BY_HOST)

        # Notify remaining players about game cancellation
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "alert",
                "message": message,
                "user_role": user_role
            }
        )

        # Cancel the game loop if running
        if hasattr(self, 'game_loop_task'):
            self.game_loop_task.cancel()

        # Delete the lobby
        await self.delete_lobby()


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
            pos = await self.match_user_id(user_id)
            if pos == 0:
                self.left_paddle_speed = speed
            elif pos == 1:
                self.right_paddle_speed = speed
            elif pos == 2:
                self.top_paddle_speed = speed
            elif pos == 3:
                self.bottom_paddle_speed = speed
            else:
                logger.warning(f"User ID {user_id} not found in the game.")

    async def game_loop(self):
        while self.game_in_progress:
            await self.game_tick()
            await asyncio.sleep(1 / 60)

    def update_paddle_position(self, paddle, speed):
        if paddle == "left":
            self.left_paddle_y = max(0, min(self.left_paddle_y + speed, 800 - 60))
        elif paddle == "right":
            self.right_paddle_y = max(0, min(self.right_paddle_y + speed, 800 - 60))
        elif paddle == "top":
            self.top_paddle_x = max(0, min(self.top_paddle_x + speed, 800 - 60))
        elif paddle == "bottom":
            self.bottom_paddle_x = max(0, min(self.bottom_paddle_x + speed, 800 - 60))

    async def game_tick(self):
        async with self.game_lock:

            # Update paddle positions
            self.update_paddle_position("left", self.left_paddle_speed)
            self.update_paddle_position("right", self.right_paddle_speed)
            self.update_paddle_position("top", self.top_paddle_speed)
            self.update_paddle_position("bottom", self.bottom_paddle_speed)

            # Update ball position
            self.ball_x += self.ball_direction_x * self.ball_speed
            self.ball_y += self.ball_direction_y * self.ball_speed

            # Paddle collision handling
            if self.ball_x - 15 <= 10 and self.left_paddle_y < self.ball_y < self.left_paddle_y + 60:
                self.ball_direction_x *= -1
                self.last_touch = "left"
            elif self.ball_x + 15 >= 790 and self.right_paddle_y < self.ball_y < self.right_paddle_y + 60:
                self.ball_direction_x *= -1
                self.last_touch = "right"
            elif self.ball_y - 15 <= 10 and self.top_paddle_x < self.ball_x < self.top_paddle_x + 60:
                self.ball_direction_y *= -1
                self.last_touch = "top"
            elif self.ball_y + 15 >= 790 and self.bottom_paddle_x < self.ball_x < self.bottom_paddle_x + 60:
                self.ball_direction_y *= -1
                self.last_touch = "bottom"

            # Scoring logic
            scoring_player = None
            if self.last_touch:
                if self.ball_x <= 0 or self.ball_x >= 800 or self.ball_y <= 0 or self.ball_y >= 800:
                    scoring_player = self.last_touch
                    await self.reset_ball()
                    if scoring_player == "left":
                        self.left_score += 1
                    elif scoring_player == "right":
                        self.right_score += 1
                    elif scoring_player == "top":
                        self.top_score += 1
                    elif scoring_player == "bottom":
                        self.bottom_score += 1
            else:
                if self.ball_x <= 0 or self.ball_x >= 800 or self.ball_y <= 0 or self.ball_y >= 800:
                    await self.reset_ball()

            # **Add this block to check for round completion**
            if any(score >= self.round_score_limit for score in [self.left_score, self.right_score, self.top_score, self.bottom_score]):
                await self.complete_round()
                return  # Exit the game tick to prevent further processing until the next loop

            # Send game state to clients
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "game_state",
                    "leftScore": self.left_score,
                    "rightScore": self.right_score,
                    "topScore": self.top_score,
                    "bottomScore": self.bottom_score,
                    "ball_x": self.ball_x,
                    "ball_y": self.ball_y,
                    "left_paddle_y": self.left_paddle_y,
                    "right_paddle_y": self.right_paddle_y,
                    "top_paddle_x": self.top_paddle_x,
                    "bottom_paddle_x": self.bottom_paddle_x,
                    "left_speed": self.left_paddle_speed,
                    "right_speed": self.right_paddle_speed,
                    "top_speed": self.top_paddle_speed,
                    "bottom_speed": self.bottom_paddle_speed,
                }
            )

    async def complete_round(self):
        print("Round completed")
        # Determine round winner
        scores = { self.game.player1.username: self.left_score,
                   self.game.player2.username: self.right_score,
                   self.game.player3.username: self.top_score,
                   self.game.player4.username: self.bottom_score }

        round_winner = max(scores, key=scores.get)

        # Record round details
        round_data = {
            'round_number': self.current_round,
            'start_time': self.round_start_time.isoformat(),
            'end_time': timezone.now().isoformat(),
            'score_player1': self.left_score,
            'score_player2': self.right_score,
            'score_player3': self.top_score,
            'score_player4': self.bottom_score,
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
        self.top_score = 0
        self.bottom_score = 0
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

    @database_sync_to_async
    def set_game_status(self, status):
        """Sets the status of the current game."""
        self.game.status = status
        self.game.save()

    async def calculate_xp_gain(self, game, player, is_winner=False):
        # Set a default duration to handle None values
        game_duration = game.duration if game.duration is not None else 0

        # Base XP values
        base_xp = 50  # Base XP for winning a game
        level_bonus = 1.5 * await self.get_player_level(player)  # Use async method to get player level

        # Calculate duration-based XP, with diminishing returns
        if game_duration < 300:  # Short game
            duration_xp = game_duration * 0.5  # 0.5 XP per second for shorter games
        elif game_duration < 1200:  # Medium game
            duration_xp = game_duration * 0.3  # 0.3 XP per second for medium length games
        else:  # Long game
            duration_xp = min(400 + (game_duration - 1200) * 0.1, 600)  # Cap XP for long games

        # Score difference multiplier for higher XP based on performance
        score_difference = abs(game.score_player1 - game.score_player2)
        performance_multiplier = 1 + min(score_difference / 100, 0.5)  # Up to +50% XP based on score gap

        # # Game mode multiplier: more challenging modes award more XP
        # if game.game_mode == Game.PVE:
        #     mode_multiplier = 0.7 if not is_winner else 1.0  # PvE easier, give less XP if lost
        # elif game.game_mode == Game.LOCAL_PVP:
        #     mode_multiplier = 1.0 if not is_winner else 1.1  # Balanced mode, slight bonus for win
        # else:
        #     mode_multiplier = 1.1 if not is_winner else 1.3  # Online PvP, higher reward for higher challenge
        mode_multiplier = 1.2 if not is_winner else 1.4  # Online PvP, higher reward for higher challenge

        # Apply base, duration, level, performance, and mode multipliers
        xp_gain = (base_xp + duration_xp + level_bonus) * performance_multiplier * mode_multiplier

        # Additional XP for winning, varies by game mode
        if is_winner:
            xp_gain += 50 if game.game_mode == Game.PVE else 75  # Higher bonus for PvP games

        return int(xp_gain)

    async def end_game(self):
        logger.info(f"Game data: {self.game}")
        self.game_in_progress = False
        # Determine game winner based on rounds won
        try:
            logger.debug(f"Player 1: {self.game.player1}, Player 2: {self.game.player2}, Player 3: {self.game.player3}, Player 4: {self.game.player4}")

            player1_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player1.username)
            player2_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player2.username)
            player3_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player3.username)
            player4_round_wins = sum(1 for r in self.rounds if r['winner'] == self.game.player4.username)

            logger.info(f"Player 1 round wins: {player1_round_wins}, Player 2 round wins: {player2_round_wins}, Player 3 round wins: {player3_round_wins}, Player 4 round wins: {player4_round_wins}")

            logger.info(f"Round data: {self.rounds}")
            self.game.score_player1 = player1_round_wins
            self.game.score_player2 = player2_round_wins
            self.game.score_player3 = player3_round_wins
            self.game.score_player4 = player4_round_wins
        except Exception as e:
            # ERROR 2024-11-09 17:58:43,417 consumers Error determining game winner: 'NoneType' object has no attribute 'username'
            logger.error(f"Error determining game winner in end_game: {e}")
            player1_round_wins = 0
            player2_round_wins = 0
            player3_round_wins = 0
            player4_round_wins = 0

        # Determine the winner based on round wins from the four players
        player_scores = {
            self.game.player1: player1_round_wins,
            self.game.player2: player2_round_wins,
            self.game.player3: player3_round_wins,
            self.game.player4: player4_round_wins
        }

        winner = max(player_scores, key=player_scores.get) if player_scores else None

        losers = [player for player in player_scores if player != winner]

        logger.info(f"Game winner: {winner}")

        # Calculate XP gain
        winner_xp = await self.calculate_xp_gain(self.game, winner, is_winner=True) if winner else 0
        loser_xps = [await self.calculate_xp_gain(self.game, player, is_winner=False) for player in losers]
  # loser_xp = max(10, await self.calculate_xp_gain(self.game, loser, is_winner=False) // 4) if loser else 0

        await self.finalize_game(winner, Game.FINISHED, winner_xp, loser_xps)

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
    def get_player_level(self, player):
        return player.profile.level

    @database_sync_to_async
    def get_player_usernames(self):
        player1_username = self.game.player1.username
        player2_username = self.game.player2.username
        player3_username = self.game.player3.username
        player4_username = self.game.player4.username
        return player1_username, player2_username, player3_username, player4_username

    @database_sync_to_async
    def finalize_game(self, winner, status, winner_xp, loser_xps):
        self.game.end_time = timezone.now()
        self.game.duration = (self.game.end_time - self.game.start_time).total_seconds()
        self.game.winner = winner
        self.game.is_completed = True
        self.game.status = status

        # Save the game instance
        self.game.save()

        # Apply XP to profiles if winner and loser are actual User instances
        if isinstance(winner, User):
            winner.profile.add_xp(winner_xp)

        for loser, loser_xp in zip([self.game.player2, self.game.player3, self.game.player4], loser_xps):
            if isinstance(loser, User):
                loser.profile.add_xp(loser_xp)

        # if isinstance(self.game.player1, User) and self.game.player1 != winner:
        #     self.game.player1.profile.add_xp(loser_xp)

        # if isinstance(self.game.player2, User) and self.game.player2 != winner:
        #     self.game.player2.profile.add_xp(loser_xp)

        # if isinstance(self.game.player3, User) and self.game.player3 != winner:
        #     self.game.player3.profile.add_xp(loser_xp)

        # if isinstance(self.game.player4, User) and self.game.player4 != winner:
        #     self.game.player4.profile.add_xp(loser_xp)

    async def reset_ball(self):
        # Reset ball position to the center
        self.ball_x = 400
        self.ball_y = 400

        self.last_touch = None

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
            "isPlayerOneReady": event["is_player_one_ready"],
            "isPlayerTwoReady": event["is_player_two_ready"],
            "isPlayerThreeReady": event["is_player_three_ready"],
            "isPlayerFourReady": event["is_player_four_ready"],
            "allReady": event["all_ready"],
            "playerOne": event["player_one_name"],
            "playerTwo": event["player_two_name"],
            "playerThree": event["player_three_name"],
            "playerFour": event["player_four_name"],
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
        lobby = ArenaLobby.objects.get(room_id=self.room_id)
        return lobby.get_lobby_state()

    @database_sync_to_async
    def update_ready_status(self, is_ready, user_id):
        try:
            with transaction.atomic():
                lobby = ArenaLobby.objects.select_for_update().get(room_id=self.room_id)
                if user_id == lobby.player_one_id:
                    lobby.is_player_one_ready = is_ready
                elif lobby.player_two and user_id == lobby.player_two_id:
                    lobby.is_player_two_ready = is_ready
                elif lobby.player_three and user_id == lobby.player_three_id:
                    lobby.is_player_three_ready = is_ready
                elif lobby.player_four and user_id == lobby.player_four_id:
                    lobby.is_player_four_ready = is_ready
                else:
                    raise PermissionDenied("User not part of this lobby.")

                lobby.save()
                return {
                    "is_player_one_ready": lobby.is_player_one_ready,
                    "is_player_two_ready": lobby.is_player_two_ready,
                    "is_player_three_ready": lobby.is_player_three_ready,
                    "is_player_four_ready": lobby.is_player_four_ready,
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
            return True
        return False

    @database_sync_to_async
    def is_user_eligible_as_guest(self):
        try:
            lobby = ArenaLobby.objects.get(room_id=self.room_id)
            if self.user == lobby.player_one or self.user == lobby.player_two or self.user == lobby.player_three or self.user == lobby.player_four:
                return False
            if lobby.player_two is None:
                lobby.player_two = self.user
                lobby.save()
                self.player_two = self.user
                self.lobby = lobby
            elif lobby.player_three is None:
                lobby.player_three = self.user
                lobby.save()
                self.player_three = self.user
                self.lobby = lobby
            elif lobby.player_four is None:
                lobby.player_four = self.user
                lobby.save()
                self.player_four = self.user
                self.lobby = lobby
            else:
                return False
        except ArenaLobby.DoesNotExist:
            return False

    @database_sync_to_async
    def is_user_host(self):
        """Check if the disconnecting user is the host."""
        lobby = ArenaLobby.objects.get(room_id=self.room_id)
        return self.user == lobby.player_one

    @database_sync_to_async
    def match_user_id(self, user_id):
        lobby = ArenaLobby.objects.get(room_id=self.room_id)
        if user_id == lobby.player_one_id:
            return 0
        elif lobby.player_two and user_id == lobby.player_two_id:
            return 1
        elif lobby.player_three and user_id == lobby.player_three_id:
            return 2
        elif lobby.player_four and user_id == lobby.player_four_id:
            return 3
        else:
            return -1

    @database_sync_to_async
    def delete_lobby(self):
        """Delete the lobby if the host disconnects."""
        ArenaLobby.objects.filter(room_id=self.room_id).delete()

    @database_sync_to_async
    def remove_guest(self):
        """Remove the guest from the lobby if the guest disconnects."""
        lobby = ArenaLobby.objects.get(room_id=self.room_id)
        temp = None
        if (lobby.player_two == self.user):
            temp = 'two'
            lobby.player_two = None
            lobby.is_player_two_ready = False
        elif (lobby.player_three == self.user):
            temp = 'three'
            lobby.player_three = None
            lobby.is_player_three_ready = False
        elif (lobby.player_four == self.user):
            temp = 'four'
            lobby.player_four = None
            lobby.is_player_four_ready = False
        lobby.save()
        return temp

# consumer to handle tournament lobby settings, ready status and game start
class TournamentLobbyConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f"tournament_lobby_{self.room_id}"
        self.user = self.scope['user']

        # Authenticate user
        if isinstance(self.user, AnonymousUser):
            await self.close()
            return

        # Add the user to the channel group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Load the lobby and broadcast the current state
        self.lobby = await database_sync_to_async(TournamentLobby.objects.get)(room_id=self.room_id)
        await self.broadcast_lobby_state()

    async def disconnect(self, close_code):
        # Remove the user from the channel group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        if await self.is_user_host():
            logger.info('Host left the tournament lobby')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "alert",
                    "message": "The host has left the lobby. The lobby has been closed.",
                    "user_role": "host"
                }
            )
            await self.delete_lobby()
        else:
            # remove user
            await self.handle_user_disconnect()
            await self.broadcast_lobby_state()
            # send alert to other users
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "alert",
                    "message": f"{self.user.username} has left the lobby.",
                    "user_role": "guest"
                }
            )
            

    async def receive_json(self, content):
        action = content.get("action")

        try:
            if action == "set_ready":
                is_ready = content.get("is_ready", False)
                logger.info(f"User {self.user.username} is ready: {is_ready}")
                await self.update_ready_status(self.user, is_ready)
            elif action == "update_settings":
                new_settings = content.get("settings", {})
                await self.update_lobby_settings(new_settings)
            elif action == "start_tournament":
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "tournament_start",
                            "message": "The Tournament has started. This lobby will be deleted.",
                        }
                    )
                    await self.start_tournament_c()
        except Exception as e:
            logger.error(f"Error processing action {action}: {e}")
            await self.send_json({
                "type": "error",
                "message": str(e)
            })
        await self.broadcast_lobby_state()

    async def alert(self, event):
        await self.send_json({
            "type": "alert",
            "message": event["message"],
            "user_role": event["user_role"]
        })

    async def tournament_start(self, event):
        await self.send_json({
            "type": "tournament_start",
            "message": event["message"]
        })

    @database_sync_to_async
    def start_tournament_c(self):
        self.lobby.refresh_from_db()
        TournamentLobbyService.start_tournament(self.lobby, self.user)
        self.lobby.save()

    @database_sync_to_async
    def update_ready_status(self, user, is_ready):
        self.lobby.refresh_from_db()
        if user in self.lobby.guests.all():
            self.lobby.guest_ready_states[str(user.id)] = is_ready
        self.lobby.save()

    @database_sync_to_async
    def update_lobby_settings(self, new_settings):
        self.lobby.refresh_from_db()
        # Update lobby settings based on the provided input
        if "max_player_count" in new_settings:
            self.lobby.max_player_count = new_settings["max_player_count"]
        # if "round_score_limit" in new_settings:
            # self.lobby.round_score_limit = new_settings["round_score_limit"]
        if "tournament_type" in new_settings:
            self.lobby.tournament_type = new_settings["tournament_type"]
        TournamentLobbyService.adjust_max_player_count(self.lobby)
        self.lobby.save()

    async def broadcast_lobby_state(self):
        lobby_state = await database_sync_to_async(self.lobby.get_lobby_state)()
        # lobby_state = await self.get_lobby_state()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "lobby_state",
                **lobby_state
            }
        )

    async def lobby_state(self, event):
        """
        Handle the 'lobby_state' WebSocket message type.
        """
        # Extract the lobby state from the event
        lobby_state = {
            "host": event.get("host"),
            "guests": event.get("guests", []),
            "all_ready": event.get("all_ready", False),
            "is_full": event.get("is_full", False),
            "active_lobby": event.get("active_lobby", False),
            "active_tournament": event.get("active_tournament", False),
            "created_at": event.get("created_at"),
            "player_count": event.get("player_count"),
            # "round_score_limit": event.get("round_score_limit"),
            "room_id": event.get("room_id"),
            "tournament_type": event.get("tournament_type"),
            "max_player_count": event.get("max_player_count")
        }

        # Send the lobby state to the WebSocket client
        await self.send(
            text_data=json.dumps({
                "type": "lobby_state",
                "lobby_state": lobby_state
            })
        )
        

    @database_sync_to_async
    def handle_user_disconnect(self):
        # Remove the user from the lobby
        logger.info(f"Removing user {self.user.username} from the lobby.")
        try:
            lobby = TournamentLobby.objects.get(room_id=self.room_id)
        except TournamentLobby.DoesNotExist: # lobby already deleted, dont need to remove guest
            return
        if self.user in self.lobby.guests.all():
            self.lobby.guests.remove(self.user)
            # Remove the user's ready state
            if str(self.user.id) in self.lobby.guest_ready_states:
                del self.lobby.guest_ready_states[str(self.user.id)]
            # Remove the user's customization
            self.lobby.guest_customizations.filter(user=self.user).delete()
            self.lobby.save()

    @database_sync_to_async
    def delete_lobby(self):
        """Delete the lobby if the host disconnects."""
        logger.info(f"Deleting tournamentlobby with room_id {self.room_id}.")
        TournamentLobby.objects.filter(room_id=self.room_id).delete()
        
    @database_sync_to_async
    def is_user_host(self):
        """Check if the disconnecting user is the host."""
        try:
            lobby = TournamentLobby.objects.get(room_id=self.room_id)
        except TournamentLobby.DoesNotExist:
            return False
        return self.user == lobby.host

#TODO when is the tournament deleted? -> when there is no player connected to the tournament websocket anymore and the tournament is done. -> if everyone leaves the tournament will automatically be done.
#TODO still shows the tournament lobby (probably doesnt get deleted) when the tournament is active -> delete lobby when tournament is active

class TournamentConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f"tournament_{self.room_id}"
        self.user = self.scope['user']
        
        # Authenticate user
        if isinstance(self.user, AnonymousUser):
            await self.close()
            return
        
        # Add the user to the channel group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        
        # Load the tournament and broadcast the initial state
        self.tournament = await database_sync_to_async(OnlineTournament.objects.get)(room_id=self.room_id)
        logger.info(f"User {self.user.username} connected to tournament {self.room_id}.")
        await self.broadcast_tournament()
        
    async def disconnect(self, close_code):
        # Remove the user from the channel group
        logger.info(f"User {self.user.username} disconnected from tournament {self.room_id}.")
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        
        await self.handle_user_disconnect()
        await self.broadcast_tournament()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "alert",
                "message": f"{self.user.username} has left the tournament.",
                "user_role": "guest"
            }
        )
        logger.info(f"User {self.user.username} disconnected from tournament {self.room_id}.")

    async def receive_json(self, content):
        action = content.get("action")
        try:
            if action == "ready":
                is_ready = content.get("ready", False)
                await self.update_ready_status(self.user, is_ready)
            if action == "get_tournament_state":
                await self.broadcast_tournament()
        except Exception as e:
            await self.send_json({
                "type": "error",
                "message": str(e)
            })
        await self.broadcast_tournament()

    @database_sync_to_async
    def handle_user_disconnect(self):
        self.tournament.refresh_from_db()
        if self.user in self.tournament.participants.all():
            self.tournament.participants.remove(self.user)
            if str(self.user.id) in self.tournament.participants_ready_states:
                del self.tournament.participants_ready_states[str(self.user.id)]
            for round in self.tournament.rounds.all(): # remove player from matches and replace with None
                for match in round.matches.all():
                    if match.status == "pending":
                        logger.info(f"Trying to remove {self.user.username} from match {match.id}")
                        removed = False
                        if self.user == match.player1:
                            match.player1 = None
                            match.winner = match.player2
                            removed = True
                        elif self.user == match.player2:
                            match.player2 = None
                            match.winner = match.player1
                            removed = True
                        if removed:
                            match.status = "completed"
                            match.save()
                            round.save()
                            break
            self.tournament.save()

    async def broadcast_tournament(self):
        tournament_state = await database_sync_to_async(self.tournament.get_tournament_state)()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "tournament_state",
                **tournament_state
            }
        )
        
    async def alert(self, event):
        """handle the alert WebSocket message type."""
        await self.send_json({
            "type": "alert",
            "message": event["message"],
            "user_role": event["user_role"]  # Send the user role along with the message
        })

    async def tournament_state(self, event):
        """handle the 'tournament_state' WebSocket message type."""
        tournament_state = {
            "room_id": event.get("room_id"),
            "name": event.get("name"),
            "tournament_type": event.get("tournament_type"),
            "status": event.get("status"),
            "rounds": event.get("rounds"),
            "participants": event.get("participants"),
            "round_robin_scores": event.get("round_robin_scores"),
            "final_winner": event.get("final_winner"),
        }
        await self.send(
            text_data=json.dumps({
                "type": "tournament_state",
                "tournament_state": tournament_state
            })
        )

    async def update_ready_status(self, user, is_ready):
        database_sync_to_async(self.tournament.refresh_from_db)()
        if user in self.tournament.participants.all():
            self.tournament.participant_ready_states[str(user.id)] = is_ready
        database_sync_to_async(self.tournament.save)()
        
    async def start_game(): ... # TODO sends message to two players who should both connect to the game consumer with a game_id from the message. should be triggered for each match when both players are ready