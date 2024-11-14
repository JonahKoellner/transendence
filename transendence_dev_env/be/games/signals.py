from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import F

from .models import Game, Tournament
from django.contrib.auth import get_user_model
from accounts.models import Profile
from accounts.utils import check_achievements

User = get_user_model()

@receiver(post_save, sender=Game)
def update_game_stats_and_check_achievements(sender, instance, created, **kwargs):
    if not created and instance.status == Game.FINISHED:
        # Calculate game duration in minutes
        if instance.end_time and instance.start_time:
            duration_minutes = (instance.end_time - instance.start_time).total_seconds() / 60.0
        else:
            duration_minutes = 0

        # Update player1 stats using queryset update
        profile1 = instance.player1.profile
        Profile.objects.filter(pk=profile1.pk).update(
            games_played=F('games_played') + 1,
            minutes_played=F('minutes_played') + duration_minutes,
            games_won=F('games_won') + (1 if instance.winner == instance.player1 else 0),
            games_lost=F('games_lost') + (0 if instance.winner == instance.player1 else 1),
        )
        # Refresh the instance from the database
        profile1.refresh_from_db()

        # Context for action-based achievements
        context1 = {
            'game_duration': duration_minutes,
            'game_won': instance.winner == instance.player1
        }

        if instance.player2:
            # Update player2 stats using queryset update
            profile2 = instance.player2.profile
            Profile.objects.filter(pk=profile2.pk).update(
                games_played=F('games_played') + 1,
                minutes_played=F('minutes_played') + duration_minutes,
                games_won=F('games_won') + (1 if instance.winner == instance.player2 else 0),
                games_lost=F('games_lost') + (0 if instance.winner == instance.player2 else 1),
            )
            # Refresh the instance from the database
            profile2.refresh_from_db()

            context2 = {
                'game_duration': duration_minutes,
                'game_won': instance.winner == instance.player2
            }

            # Check if players are friends
            are_friends = profile1.friends.filter(id=profile2.user.id).exists()
            if are_friends:
                Profile.objects.filter(pk__in=[profile1.pk, profile2.pk]).update(
                    games_with_friends=F('games_with_friends') + 1
                )
                # Refresh instances
                profile1.refresh_from_db()
                profile2.refresh_from_db()

            # Check achievements with context
            check_achievements(profile1.user, context=context1)
            check_achievements(profile2.user, context=context2)
        else:
            # Single-player game
            check_achievements(profile1.user, context=context1)

@receiver(post_save, sender=Tournament)
def update_tournament_stats_and_check_achievements(sender, instance, created, **kwargs):
    if not created and instance.status == 'completed':
        # Update participant stats
        for username in instance.players_only or []:
            try:
                user = User.objects.get(username=username)
                profile = user.profile
                profile.tournaments_participated = F('tournaments_participated') + 1
                profile.save()
                check_achievements(user)
            except User.DoesNotExist:
                continue  # Skip if user not found

        # Update winner's stats
        try:
            winner_user = User.objects.get(username=instance.final_winner)
            profile = winner_user.profile
            profile.tournaments_won = F('tournaments_won') + 1
            profile.save()
            check_achievements(winner_user)
        except User.DoesNotExist:
            pass
