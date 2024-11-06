from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Lobby
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.contrib.auth.models import AnonymousUser
import asyncio

import logging
logger = logging.getLogger('game_debug')
class LobbyConsumer(AsyncJsonWebsocketConsumer):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.game_in_progress = False  # Initialize game_in_progress here

    async def start_game(self):
        if self.game_in_progress:
            return  # Prevent starting a new game if one is already in progress
        
        # Initialize game state
        self.game_in_progress = True
        self.left_paddle_y = 250
        self.right_paddle_y = 250
        self.ball_x = 500
        self.ball_y = 250
        self.ball_direction_x = 1
        self.ball_direction_y = 0.5
        self.left_score = 0
        self.right_score = 0
        self.left_paddle_speed = 0    # Initialize left paddle speed
        self.right_paddle_speed = 0   # Initialize right paddle speed

        # Notify players that the game has started
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "game_started"}
        )

        # Start the game loop
        self.game_loop_task = asyncio.create_task(self.game_loop())
        
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'lobby_{self.room_id}'
        self.user = self.scope['user']

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

        # Add the user as the guest if applicable and broadcast updated state
        if await self.add_guest_if_applicable():
            await self.broadcast_lobby_state()  # Broadcast if guest is added
        
        # Always send the initial state of the lobby to the connecting user
        await self.send_initial_state()  # Send the initial state to connecting user only

        # Ensure the state is broadcast to all members regardless of guest addition
        await self.broadcast_lobby_state()

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
        else:
            # If the guest disconnects, remove them from the lobby and notify the host
            await self.remove_guest()
            alert_message = "The guest has left the game. Waiting for a new player to join."

        # Broadcast an alert to remaining players
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "alert",
                "message": alert_message
            }
        )
        
    async def alert(self, event):
        await self.send_json({
            "type": "alert",
            "message": event["message"]
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
        is_keydown = action == "keydown"

        logger.debug(f"Key event received: {action} for user {user_id} with key {key}")

        if await self.is_user_host_id(user_id):
            # Host controls the left paddle
            if key == "KeyW":
                self.left_paddle_speed = -10 if is_keydown else 0
                logger.debug(f"Host moving left paddle, speed: {self.left_paddle_speed}")
            elif key == "KeyS":
                self.left_paddle_speed = 10 if is_keydown else 0
                logger.debug(f"Host moving left paddle, speed: {self.left_paddle_speed}")
        else:
            # Guest controls the right paddle
            if key == "KeyW":
                self.right_paddle_speed = -10 if is_keydown else 0
                logger.debug(f"Guest moving right paddle, speed: {self.right_paddle_speed}")
            elif key == "KeyS":
                self.right_paddle_speed = 10 if is_keydown else 0
                logger.debug(f"Guest moving right paddle, speed: {self.right_paddle_speed}")
                
    async def game_loop(self):
        while self.game_in_progress:
            await self.game_tick()
            await asyncio.sleep(1 / 60)

    async def game_tick(self):
        # Update paddles with their respective speeds
        self.left_paddle_y += self.left_paddle_speed
        self.right_paddle_y += self.right_paddle_speed

        # Ensure paddles stay within bounds
        self.left_paddle_y = max(0, min(self.left_paddle_y, 500 - 60))  # assuming 60 as paddle height
        self.right_paddle_y = max(0, min(self.right_paddle_y, 500 - 60))

        logger.debug(f"Left paddle position: {self.left_paddle_y}, speed: {self.left_paddle_speed}")
        logger.debug(f"Right paddle position: {self.right_paddle_y}, speed: {self.right_paddle_speed}")
        
        # Ball movement and collision logic
        self.ball_x += self.ball_direction_x * 5
        self.ball_y += self.ball_direction_y * 5

        # Collision with top/bottom walls
        if self.ball_y <= 0 or self.ball_y >= 500:
            self.ball_direction_y *= -1

        # Collision with paddles
        if self.ball_x <= 10 and self.left_paddle_y < self.ball_y < self.left_paddle_y + 60:
            self.ball_direction_x *= -1
        elif self.ball_x >= 990 and self.right_paddle_y < self.ball_y < self.right_paddle_y + 60:
            self.ball_direction_x *= -1

        # Scoring logic
        if self.ball_x <= 0:
            self.right_score += 1
            await self.reset_ball()
        elif self.ball_x >= 1000:
            self.left_score += 1
            await self.reset_ball()

        # Broadcast updated game state
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "game_state",
                "leftScore": self.left_score,
                "rightScore": self.right_score,
                "ball_x": self.ball_x,
                "ball_y": self.ball_y,
                "left_paddle_y": self.left_paddle_y,
                "right_paddle_y": self.right_paddle_y
            }
        )
    
    async def reset_ball(self):
        self.ball_x = 500
        self.ball_y = 250
        self.ball_direction_x *= -1  # Send the ball towards the last scorer

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

    @database_sync_to_async
    def is_user_host(self):
        """Check if the disconnecting user is the host."""
        lobby = Lobby.objects.get(room_id=self.room_id)
        return self.user == lobby.host
    
    @database_sync_to_async
    def is_user_host_id(self, user_id):
        # Accurately checks if the provided user_id belongs to the host
        lobby = Lobby.objects.get(room_id=self.room_id)
        return user_id == lobby.host.id

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
