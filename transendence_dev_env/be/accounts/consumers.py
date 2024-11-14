import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Notification, ChatMessage

User = get_user_model()

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.group_name = None  # Ensures group_name is initialized
        
    async def connect(self):
        user = self.scope['user']
        if user.is_anonymous:
            print("User is anonymous, closing connection.")
            await self.close()
        else:
            print(f"User {user.username} is connecting...")
            self.group_name = f'notifications_{user.id}'
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
            await self.set_user_online(True)

    async def disconnect(self, close_code):
        print(f"Disconnecting with group_name: {self.group_name}")
        if self.group_name:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
        await self.set_user_online(False)

    async def send_notification(self, event):
        await self.send_json(event['content'])

    @database_sync_to_async
    def set_user_online(self, is_online):
        user = self.scope.get('user')
        #WIP TODO - set user online or offline
        if user.is_authenticated:
            user.profile.is_online = is_online
            user.profile.save(update_fields=["is_online"])  # Persist state change explicitly
