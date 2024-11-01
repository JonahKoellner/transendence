from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import transaction
from django.contrib.auth import get_user_model
User = get_user_model()

@transaction.atomic
def update_profile_with_transaction(user, profile_data):
    """
    Updates the user's profile within an atomic transaction.
    """
    for attr, value in profile_data.items():
        setattr(user.profile, attr, value)
    user.profile.save()
    
def create_notification(sender, receiver, notification_type, data=None, priority='medium'):
    from .models import Notification
    from .serializers import UserMinimalSerializer
    notification = Notification.objects.create(
        sender=sender,
        receiver=receiver,
        notification_type=notification_type,
        data=data,
        priority=priority
    )

    # Serialize sender and receiver details using UserMinimalSerializer
    serialized_sender = UserMinimalSerializer(sender).data
    serialized_receiver = UserMinimalSerializer(receiver).data

    # Send the notification via WebSocket
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'notifications_{receiver.id}',
        {
            'type': 'send_notification',
            'content': {
                'id': notification.id,
                'sender': serialized_sender,
                'receiver': serialized_receiver,
                'notification_type': notification.notification_type,
                'priority': notification.priority,
                'timestamp': notification.timestamp.isoformat(),
                'is_read': notification.is_read,
                'data': notification.data,
            }
        }
    )
