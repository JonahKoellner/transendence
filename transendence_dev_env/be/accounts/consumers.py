import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Notification, ChatMessage

User = get_user_model()

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        if user.is_anonymous:
            await self.close()
        else:
            self.group_name = f'notifications_{user.id}'
            await self.channel_layer.group_add(
                self.group_name,
                self.channel_name
            )
            await self.accept()
            await self.set_user_online(True)

    async def disconnect(self, close_code):
        user = self.scope['user']
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        await self.set_user_online(False)

    async def send_notification(self, event):
        await self.send_json(event['content'])

    @database_sync_to_async
    def set_user_online(self, status):
        user = self.scope['user']
        user.is_online = status
        user.save()

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        if user.is_anonymous:
            await self.close()
        else:
            self.user = user
            self.room_name = self.scope['url_route']['kwargs']['room_name']
            self.room_group_name = f'chat_{self.room_name}'

            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
            print(f'User {user.username} connected to WebSocket')  # Debug log

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive_json(self, content):
        print(f'Received message: {content}')
        message = content.get('message')
        receiver_username = content.get('receiver')
        receiver = await self.get_user(receiver_username)

        if receiver:
            # Save message to DB
            chat_message = await self.save_message(self.user, receiver, message)

            # Notify the receiver
            if receiver.id != self.user.id:
                await self.channel_layer.group_send(
                    f'chat_{receiver.id}',
                    {
                        'type': 'chat_message',  # This type should match what the front-end expects
                        'content': {
                            'id': chat_message.id,
                            'sender': self.user.username,
                            'receiver': receiver.username,
                            'message': chat_message.message,
                            'timestamp': chat_message.timestamp.isoformat(),
                            'is_read': chat_message.is_read,
                        }
                    }
                )

            # Send confirmation to the sender (optional)
            await self.send_json({
                'status': 'Message sent',
                'message': message,
                'receiver': receiver.username,
                'timestamp': chat_message.timestamp.isoformat(),
            })

    async def send_chat_message(self, event):
        # Forward message to WebSocket (the front-end will receive this)
        await self.send_json(event['content'])

    @database_sync_to_async
    def get_user(self, username):
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def save_message(self, sender, receiver, message):
        return ChatMessage.objects.create(sender=sender, receiver=receiver, message=message)
