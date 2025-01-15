from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import transaction
from django.contrib.auth.models import User
import logging
logger = logging.getLogger('utils_debug')
@transaction.atomic
def update_profile_with_transaction(user, profile_data):
    # with transaction.atomic():
        profile = user.profile
        original_display_name = profile.display_name
        # Update the profile fields
        for attr, value in profile_data.items():
            setattr(profile, attr, value)
        # Check if display name has changed
        if 'display_name' in profile_data and profile_data['display_name'] != original_display_name:
            profile.display_name_changed = True
        profile.save()
        # After saving the profile, check for achievements
        check_achievements(user)

def get_display_name(user: User) -> str:
    """
    Return the user.profile.display_name if it's set;
def get_display_name(user: 'User') -> str:
    """
    if not user:
        return None
    # Safely handle the case if the user doesn't have a profile or the display_name is None
    if hasattr(user, 'profile') and user.profile and user.profile.display_name:
        return user.profile.display_name
    return user.username

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

def check_achievements(user, context=None):
    logger.debug(f'Checking achievements for user {user}')
    from .models import Achievement, UserAchievement
    profile = user.profile
    if context is None:
        context = {}
    earned_achievements = set(UserAchievement.objects.filter(user=user).values_list('achievement_id', flat=True))

    # Fetch all achievements that the user hasn't earned yet
    achievements_to_check = Achievement.objects.exclude(id__in=earned_achievements)
    logger.debug(f'Checking {len(achievements_to_check)} achievements')
    logger.debug(f'User has {len(earned_achievements)} achievements')

    for achievement in achievements_to_check:
        if achievement.criteria_type == 'stat':
            user_stat_value = getattr(profile, achievement.criteria_key, None)
            logger.debug(f'Achievement: {achievement.name}, Criteria Key: {achievement.criteria_key}, User Stat Value: {user_stat_value}, Type: {type(user_stat_value)}')
            
            if callable(user_stat_value):
                try:
                    user_stat_value = user_stat_value()
                    logger.debug(f'Callable Criteria Key: {achievement.criteria_key}, Result: {user_stat_value}, Type: {type(user_stat_value)}')
                except Exception as e:
                    logger.error(f'Error calling {achievement.criteria_key}: {e}')
                    continue  # Skip awarding this achievement due to error
            
            if isinstance(user_stat_value, (int, float)) and achievement.criteria_value:
                if user_stat_value >= achievement.criteria_value:
                    award_achievement(user, achievement)
            else:
                logger.error(f'Invalid user_stat_value for {achievement.criteria_key}: {user_stat_value} (Type: {type(user_stat_value)})')
        elif achievement.criteria_type == 'action':
            # Add profile fields to context
            context.update({
                'blocked_user': profile.blocked_users_count > 0,
                'display_name_changed': profile.display_name_changed,
                # Add other context variables as needed
            })
            # Evaluate the criteria expression safely
            if evaluate_expression(achievement.criteria_expression, context):
                award_achievement(user, achievement)

def award_achievement(user, achievement):
    from .models import UserAchievement
    UserAchievement.objects.get_or_create(user=user, achievement=achievement)
    # Optionally, award points or XP
    user.profile.add_xp(achievement.points)
    # Create a notification
    create_notification(
        sender=user,
        receiver=user,
        notification_type='achievement_unlocked',
        priority='low',
        data={'achievement_name': achievement.name}
    )

def evaluate_expression(expression, context):
    """
    Safely evaluate a simple boolean expression.
    """
    try:
        # Allowed names for safety
        allowed_names = {
            'True': True,
            'False': False,
            # Include any other functions or operators you need
        }
        allowed_names.update(context)
        # Parse the expression
        code = compile(expression, "<string>", "eval")
        # Check for disallowed names
        for name in code.co_names:
            if name not in allowed_names:
                raise NameError(f"Use of '{name}' not allowed")
        return eval(code, {"__builtins__": None}, allowed_names)
    except Exception as e:
        # Handle exceptions or log errors
        return False