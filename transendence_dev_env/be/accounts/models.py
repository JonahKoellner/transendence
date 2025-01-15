from django.conf import settings
from django.db import models
from django.contrib.auth.models import User
import pyotp
from django.db.models import Avg, Max
from .utils import create_notification
from django.apps import apps
from django.utils import timezone
import re
from django.core.exceptions import ValidationError

def validate_hex_color(value):
    if not re.match(r'^#(?:[0-9a-fA-F]{3}){1,2}$', value):
        raise ValidationError(f'{value} is not a valid hex color code.')
    
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    otp_secret = models.CharField(max_length=32, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)
    last_login = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    last_user_agent = models.TextField(null=True, blank=True)
    has_logged_in = models.BooleanField(default=False)

    display_name = models.CharField(max_length=25, unique=False, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    
    friends = models.ManyToManyField('self', symmetrical=False, related_name='friends_with', blank=True)
    blocked_users = models.ManyToManyField('self', symmetrical=False, related_name='blocked_by', blank=True)
    is_online = models.BooleanField(default=False)
    
    xp = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    
    is_ft_authenticated = models.BooleanField(default=False)
    
    # Stats tracking for achievements
    games_played = models.IntegerField(default=0)
    games_won = models.IntegerField(default=0)
    games_lost = models.IntegerField(default=0)
    tournaments_participated = models.IntegerField(default=0)
    tournaments_won = models.IntegerField(default=0)
    minutes_played = models.FloatField(default=0.0)
    friends_count = models.IntegerField(default=0)
    blocked_users_count = models.IntegerField(default=0)
    display_name_changed = models.BooleanField(default=False)
    login_streak = models.IntegerField(default=0)
    last_login_date = models.DateField(null=True, blank=True)
    messages_sent = models.IntegerField(default=0)
    games_with_friends = models.IntegerField(default=0)
    
    # **New Fields for Game Settings**
    paddleskin_color = models.CharField(
        max_length=7,  # e.g., '#FFFFFF'
        blank=True,
        null=True,
        validators=[validate_hex_color],
        help_text='Hex code for paddle color.',
        default='#FFFFFF'
    )
    paddleskin_image = models.ImageField(
        upload_to='paddle_skins/',
        blank=True,
        null=True,
        help_text='Image for paddle skin.'
    )
    
    ballskin_color = models.CharField(
        max_length=7,
        blank=True,
        null=True,
        validators=[validate_hex_color],
        help_text='Hex code for ball color.',
        default='#FFFFFF'
    )
    ballskin_image = models.ImageField(
        upload_to='ball_skins/',
        blank=True,
        null=True,
        help_text='Image for ball skin.'
    )
    
    gamebackground_color = models.CharField(
        max_length=7,
        blank=True,
        null=True,
        validators=[validate_hex_color],
        help_text='Hex code for game background color.',
        default='#000000'
    )
    gamebackground_wallpaper = models.ImageField(
        upload_to='game_backgrounds/',
        blank=True,
        null=True,
        help_text='Image for game background wallpaper.'
    )
    
    
    def save(self, *args, **kwargs):
        if self.pk:
            original = Profile.objects.get(pk=self.pk)
            if original.display_name != self.display_name:
                self.display_name_changed = True
        super().save(*args, **kwargs)

    
    # Generate a new OTP secret and provisioning URI for QR code
    def generate_otp(self):
        if not self.otp_secret:
            self.otp_secret = pyotp.random_base32()
            self.save()
        totp = pyotp.TOTP(self.otp_secret)
        otp_uri = totp.provisioning_uri(name=self.user.username, issuer_name='PongArena')
        return otp_uri

    # Generate the provisioning URI for QR code
    def get_otp_uri(self):
        return pyotp.TOTP(self.otp_secret).provisioning_uri(self.user.email, issuer_name="PongArena")

    # Verify the OTP code entered by the user
    def verify_otp(self, otp_code):
        totp = pyotp.TOTP(self.otp_secret)
        return totp.verify(otp_code)
    
    def add_friend(self, user):
        self.friends.add(user)
    
    def remove_friend(self, user):
        self.friends.remove(user)
    
    def get_friends(self):
        return self.friends.all()

    def add_xp(self, xp_amount):
        """
        Add XP to the profile, level up if the XP threshold is met, and handle multiple level-ups.
        """
        self.xp += xp_amount
        leveled_up = False

        # Loop to handle cases where XP overflow could result in multiple level-ups
        while self.xp >= self.xp_for_next_level():
            # Subtract required XP for the current level
            self.xp -= self.xp_for_next_level()
            # Increment the level
            self.level += 1
            leveled_up = True

        self.save()

        # Create a notification if the player leveled up
        if leveled_up:
            create_notification(
                sender=self.user,
                receiver=self.user,
                notification_type='level_up',
                priority='medium',
                data={'new_level': self.level}
            )

    def xp_for_next_level(self):
        """
        Calculate the XP required for the next level using a combination of linear and exponential growth.
        """
        base_xp = 100  # Base XP for level 1
        linear_growth = 2.5  # Constant increase per level for linear scaling
        exponential_growth_rate = 1.05  # Slightly lower exponential factor for smoother scaling

        # Calculate XP using combined linear and exponential growth components
        return int(base_xp + (linear_growth * self.level) + (base_xp * (exponential_growth_rate ** self.level)))
    
    def calculate_profile_color(self):
        """
        Calculate a dynamic profile color based on the user's stats.
        Returns a hex color code.
        """

        # Fetch stats dynamically from other users to avoid hardcoded maximums
        max_level = Profile.objects.aggregate(Max('level'))['level__max'] or 1
        avg_game_count = Profile.objects.annotate(game_count=models.Count('user__games_as_player1') + models.Count('user__games_as_player2')).aggregate(Avg('game_count'))['game_count__avg'] or 1
        avg_tournament_count = Profile.objects.annotate(tournament_count=models.Count('user__hosted_tournaments')).aggregate(Avg('tournament_count'))['tournament_count__avg'] or 1

        # Calculate hue based on relative level position
        hue = (self.level / max_level) * 360

        # Calculate win rate and map to saturation
        win_rate = self.get_win_rate()  # Custom method to calculate win rate
        saturation = win_rate * 100  # Saturation as a percentage

        # Calculate lightness based on game and tournament participation relative to averages
        game_count = self.get_total_games_played()
        tournament_count = self.get_total_tournaments_participated()

        # Lightness calculation with participation effect
        lightness = 50 + min(game_count / avg_game_count, 1.0) * 25 + min(tournament_count / avg_tournament_count, 1.0) * 25
        lightness = min(lightness, 100)  # Ensure lightness does not exceed 100%

        # Highlight boost for high tournament wins or top ranks
        if self.is_top_tournament_rank():
            hue = (hue + 30) % 360  # Special hue shift for top players

        # Convert HSL to RGB for web usage
        rgb = self.hsl_to_rgb(hue, saturation, lightness)
        hex_color = '#%02x%02x%02x' % rgb
        return hex_color

    def get_win_rate(self):
        """Calculate the win rate of the user across games and tournaments."""
        total_games = self.get_total_games_played()
        total_wins = self.get_total_wins()
        return total_wins / total_games if total_games > 0 else 0

    def get_total_games_played(self):
        """Return the total number of games the user has played."""
        Game = apps.get_model('games', 'Game')  # Dynamically load Game model
        return Game.objects.filter(models.Q(player1=self.user) | models.Q(player2=self.user)).count()

    def get_total_tournaments_participated(self):
        """Return the total number of tournaments the user has participated in."""
        Tournament = apps.get_model('games', 'Tournament')  # Dynamically load Tournament model
        return Tournament.objects.filter(host=self.user).count()

    def get_total_wins(self):
        """Calculate total wins across all games and tournaments."""
        Game = apps.get_model('games', 'Game')
        Tournament = apps.get_model('games', 'Tournament')
        game_wins = Game.objects.filter(winner=self.user).count()
        tournament_wins = Tournament.objects.filter(final_winner=self.user.username).count()
        return game_wins + tournament_wins

    def is_top_tournament_rank(self):
        """Check if the user has a top rank in tournaments based on wins or placement."""
        Tournament = apps.get_model('games', 'Tournament')
        top_players = Tournament.objects.values('host').annotate(total_wins=models.Count('final_winner')).order_by('-total_wins')[:5]
        return any(player['host'] == self.user.id for player in top_players)

    def hsl_to_rgb(self, h, s, l):
        """Convert HSL color space to RGB."""
        h = h / 360.0
        s = s / 100.0
        l = l / 100.0

        if s == 0:
            r = g = b = l  # Achromatic
        else:
            def hue_to_rgb(p, q, t):
                if t < 0:
                    t += 1
                if t > 1:
                    t -= 1
                if t < 1/6:
                    return p + (q - p) * 6 * t
                if t < 1/2:
                    return q
                if t < 2/3:
                    return p + (q - p) * (2/3 - t) * 6
                return p

            q = l * (1 + s) if l < 0.5 else l + s - l * s
            p = 2 * l - q
            r = hue_to_rgb(p, q, h + 1/3)
            g = hue_to_rgb(p, q, h)
            b = hue_to_rgb(p, q, h - 1/3)

        return (int(r * 255), int(g * 255), int(b * 255))
    
class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('friend_request', 'Friend Request'),
        ('friend_request_accepted', 'Friend Accept'),
        ('friend_request_rejected', 'Friend Reject'),
        ('game_invite', 'Game Invite'),
        ('arena_invite', 'Arena Invite'),
        ('tournament', 'Tournament Notification'),
        ('new_message', 'New Message'),
        ('system_alert', 'System Alert'),
        ('level_up', 'Level Up'),
        ('achievement_unlocked', 'Achievement Unlocked'),
    )
    PRIORITY_LEVELS = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    )
    
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_notifications', on_delete=models.CASCADE)
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='notifications', on_delete=models.CASCADE)
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES)
    priority = models.CharField(max_length=10, choices=PRIORITY_LEVELS, default='medium')
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    data = models.JSONField(null=True, blank=True)  # Additional contextual data
    game_type = models.CharField(max_length=20, blank=True, null=True)
    
    class Meta:
        ordering = ['-timestamp']

        
class ChatMessage(models.Model):
    sender = models.ForeignKey(User, related_name='sent_messages', on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name='received_messages', on_delete=models.CASCADE)
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']
        
class FriendRequest(models.Model):
    PENDING = 'pending'
    ACCEPTED = 'accepted'
    REJECTED = 'rejected'

    STATUS_CHOICES = [
        (PENDING, 'Pending'),
        (ACCEPTED, 'Accepted'),
        (REJECTED, 'Rejected'),
    ]

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_friend_requests', on_delete=models.CASCADE)
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='received_friend_requests', on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('sender', 'receiver')

    def __str__(self):
        return f"{self.sender} -> {self.receiver} ({self.status})"
    

class Achievement(models.Model):
    """
    Represents an achievement that can be earned by users.
    """
    # Basic information
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField()
    points = models.IntegerField(default=0)  # Points awarded for earning the achievement

    # Criteria types and expressions
    CRITERIA_TYPES = (
        ('stat', 'Stat-based'),
        ('action', 'Action-based'),
    )
    criteria_type = models.CharField(max_length=20, choices=CRITERIA_TYPES)
    criteria_key = models.CharField(max_length=50, blank=True, null=True)
    criteria_value = models.IntegerField(null=True, blank=True)
    criteria_expression = models.CharField(max_length=255, blank=True, null=True)  # For complex criteria
    
    image_url = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return self.name

class UserAchievement(models.Model):
    """
    Represents the achievements earned by a user.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='user_achievements')
    date_earned = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('user', 'achievement')

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name}"