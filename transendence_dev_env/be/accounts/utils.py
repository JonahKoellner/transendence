from .models import Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def create_notification(sender, receiver, notification_type, data=None, priority='medium'):
    notification = Notification.objects.create(
        sender=sender,
        receiver=receiver,
        notification_type=notification_type,
        data=data,
        priority=priority
    )
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'notifications_{receiver.id}',
        {
            'type': 'send_notification',
            'content': {
                'id': notification.id,
                'sender': sender.username,
                'notification_type': notification.notification_type,
                'priority': notification.priority,
                'timestamp': notification.timestamp.isoformat(),
                'is_read': notification.is_read,
                'data': notification.data,
            }
        }
    )
