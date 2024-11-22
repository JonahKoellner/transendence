from django.db.models.signals import m2m_changed, post_save
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in
from django.contrib.auth.models import User
from datetime import date, timedelta
from django.db.models import F
from .models import Profile,ChatMessage
from .utils import check_achievements

@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_profile(sender, instance, **kwargs):
    instance.profile.save()  # Save without refreshing to avoid overwriting changes
    
@receiver(m2m_changed, sender=Profile.friends.through)
def update_friends_count_and_check_achievements(sender, instance, action, **kwargs):
    if action in ['post_add', 'post_remove']:
        instance.friends_count = instance.friends.count()
        instance.save()
        check_achievements(instance.user)

@receiver(m2m_changed, sender=Profile.blocked_users.through)
def update_blocked_users_count_and_check_achievements(sender, instance, action, **kwargs):
    if action == 'post_add':
        instance.blocked_users_count = instance.blocked_users.count()
        instance.save()
        check_achievements(instance.user)

@receiver(post_save, sender=Profile)
def check_display_name_change(sender, instance, created, **kwargs):
    if not created and instance.display_name_changed:
        check_achievements(instance.user)

@receiver(user_logged_in)
def update_login_streak(sender, user, request, **kwargs):
    profile = user.profile
    today = date.today()
    if profile.last_login_date == today - timedelta(days=1):
        profile.login_streak = F('login_streak') + 1
    else:
        profile.login_streak = 1
    profile.last_login_date = today
    profile.save()
    check_achievements(user)
    
@receiver(post_save, sender=ChatMessage)
def update_messages_sent_and_check_achievements(sender, instance, created, **kwargs):
    if created:
        profile = instance.sender.profile
        profile.messages_sent = F('messages_sent') + 1
        profile.save()
        check_achievements(instance.sender)