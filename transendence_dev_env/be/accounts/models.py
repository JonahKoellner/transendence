from django.conf import settings
from django.db import models
from django.contrib.auth.models import User
import pyotp

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    otp_secret = models.CharField(max_length=16, blank=True, null=True)
    is_2fa_enabled = models.BooleanField(default=False)
    has_logged_in = models.BooleanField(default=False)

    display_name = models.CharField(max_length=255, unique=True, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', default='avatars/default_avatar.png', blank=True, null=True)
    
    friends = models.ManyToManyField('self', symmetrical=False, related_name='friends_with', blank=True)
    blocked_users = models.ManyToManyField('self', symmetrical=False, related_name='blocked_by', blank=True)
    is_online = models.BooleanField(default=False)
    
    xp = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    
    # Generate a new OTP secret and provisioning URI for QR code
    def generate_otp(self):
        if not self.otp_secret:
            self.otp_secret = pyotp.random_base32()
            self.save()
        totp = pyotp.TOTP(self.otp_secret)
        otp_uri = totp.provisioning_uri(name=self.user.username, issuer_name='YourAppName')
        return otp_uri

    # Generate the provisioning URI for QR code
    def get_otp_uri(self):
        return pyotp.TOTP(self.otp_secret).provisioning_uri(self.user.email, issuer_name="YourApp")

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
    
    def xp_for_next_level(self):
        """ Calculate XP needed for the next level using exponential growth. """
        return int(100 * (1.1 ** self.level))  # Example: exponential growth in XP requirements

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
            Notification.objects.create(
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