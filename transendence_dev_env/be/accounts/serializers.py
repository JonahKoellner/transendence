from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Profile, User, Notification, ChatMessage, FriendRequest, Achievement, UserAchievement
from django.db import transaction
from games.models import Lobby
import re
from .utils import check_achievements

def validate_hex_color(value):
    if not re.match(r'^#(?:[0-9a-fA-F]{3}){1,2}$', value):
        raise serializers.ValidationError(f'{value} is not a valid hex color code.')

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('username', 'email', 'password')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        user.profile.save()  # Ensure profile is created
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')
        user = authenticate(username=username, password=password)

        if user is None:
            raise serializers.ValidationError("Invalid credentials")
        
        return user

class OTPVerifySerializer(serializers.Serializer):
    otp_code = serializers.CharField()

class UserProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='profile.display_name', required=False)
    avatar = serializers.ImageField(source='profile.avatar', required=False)
    friends = serializers.SerializerMethodField()
    blocked_users = serializers.SerializerMethodField()
    is_2fa_enabled  = serializers.BooleanField(source='profile.is_2fa_enabled', read_only=True)
    has_logged_in = serializers.BooleanField(source='profile.has_logged_in')
    
    is_online = serializers.BooleanField(source='profile.is_online', read_only=True)
    
    xp = serializers.IntegerField(source='profile.xp', read_only=True)
    level = serializers.IntegerField(source='profile.level', read_only=True)
    xp_for_next_level = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()
    
    avatar_to_delete = serializers.BooleanField(write_only=True, required=False)
    paddleskin_image_to_delete = serializers.BooleanField(write_only=True, required=False)
    ballskin_image_to_delete = serializers.BooleanField(write_only=True, required=False)
    gamebackground_wallpaper_to_delete = serializers.BooleanField(write_only=True, required=False)
    is_ft_authenticated = serializers.BooleanField(source='profile.is_ft_authenticated', required=False)
    
    paddleskin_color = serializers.CharField(
        source='profile.paddleskin_color', 
        required=False, 
        validators=[validate_hex_color],
        allow_blank=True
    )
    paddleskin_image = serializers.ImageField(
        source='profile.paddleskin_image', 
        required=False
    )
    ballskin_color = serializers.CharField(
        source='profile.ballskin_color', 
        required=False, 
        validators=[validate_hex_color],
        allow_blank=True
    )
    ballskin_image = serializers.ImageField(
        source='profile.ballskin_image', 
        required=False
    )
    gamebackground_color = serializers.CharField(
        source='profile.gamebackground_color', 
        required=False, 
        validators=[validate_hex_color],
        allow_blank=True
    )
    gamebackground_wallpaper = serializers.ImageField(
        source='profile.gamebackground_wallpaper', 
        required=False
    )
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'display_name', 'avatar', 'friends',
            'blocked_users', 'is_online', 'is_2fa_enabled', 'has_logged_in',
            'xp', 'level', 'xp_for_next_level', 'achievements',
            'paddleskin_color', 'paddleskin_image',
            'ballskin_color', 'ballskin_image',
            'gamebackground_color', 'gamebackground_wallpaper',
            'avatar_to_delete',
            'paddleskin_image_to_delete',
            'ballskin_image_to_delete',
            'gamebackground_wallpaper_to_delete',
            'is_ft_authenticated',
        ]
        # read_only_fields = ['is_2fa_enabled']

    def get_friends(self, obj):
        friends_users = [profile.user for profile in obj.profile.friends.all()]
        return UserDetailSerializer(friends_users, many=True, context=self.context).data  # Passed context

    def get_blocked_users(self, obj):
        blocked_profiles = obj.profile.blocked_users.all()
        blocked_users = [profile.user for profile in blocked_profiles]
        return UserDetailSerializer(blocked_users, many=True, context=self.context).data
    
    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})

        # Extract deletion flags
        avatar_to_delete = validated_data.pop('avatar_to_delete', False)
        paddleskin_image_to_delete = validated_data.pop('paddleskin_image_to_delete', False)
        ballskin_image_to_delete = validated_data.pop('ballskin_image_to_delete', False)
        gamebackground_wallpaper_to_delete = validated_data.pop('gamebackground_wallpaper_to_delete', False)

        profile = instance.profile

        # Handle avatar deletion
        if avatar_to_delete and profile.avatar:
            profile.avatar.delete(save=False)
            profile.avatar = None

        # Handle paddleskin image deletion
        if paddleskin_image_to_delete and profile.paddleskin_image:
            profile.paddleskin_image.delete(save=False)
            profile.paddleskin_image = None

        # Handle ballskin image deletion
        if ballskin_image_to_delete and profile.ballskin_image:
            profile.ballskin_image.delete(save=False)
            profile.ballskin_image = None

        # Handle game background wallpaper deletion
        if gamebackground_wallpaper_to_delete and profile.gamebackground_wallpaper:
            profile.gamebackground_wallpaper.delete(save=False)
            profile.gamebackground_wallpaper = None

        # Update other profile fields within a transaction
        with transaction.atomic():
            # Update profile fields
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            
            # Check if display name has changed
            if 'display_name' in profile_data and profile_data['display_name'] != profile.display_name:
                profile.display_name_changed = True
            
            profile.save()
            
            # After saving the profile, check for achievements
            check_achievements(instance)

        # Update User fields if any (e.g., email)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


    def get_xp_for_next_level(self, obj):
        """Get the XP required to reach the next level."""
        return obj.profile.xp_for_next_level()
    
    def get_achievements(self, obj):
        """
        Returns a list of the user's achievements serialized using AchievementSerializer.
        """
        user_achievements = obj.user_achievements.all().select_related('achievement')
        achievements = [ua.achievement for ua in user_achievements]
        return AchievementSerializer(achievements, many=True, context=self.context).data

class TokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()
    access = serializers.CharField()

class UserDetailSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='profile.display_name', required=False)
    avatar = serializers.ImageField(source='profile.avatar', required=False)
    is_online = serializers.BooleanField(source='profile.is_online', read_only=True)
    is_2fa_enabled  = serializers.BooleanField(source='profile.is_2fa_enabled')
    xp = serializers.IntegerField(source='profile.xp', read_only=True)
    level = serializers.IntegerField(source='profile.level', read_only=True)
    xp_for_next_level = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()
    is_ft_authenticated = serializers.BooleanField(source='profile.is_ft_authenticated')
    paddleskin_color = serializers.CharField(
        source='profile.paddleskin_color', 
        required=False, 
        validators=[validate_hex_color],
        allow_blank=True
    )
    paddleskin_image = serializers.ImageField(
        source='profile.paddleskin_image', 
        required=False
    )
    ballskin_color = serializers.CharField(
        source='profile.ballskin_color', 
        required=False, 
        validators=[validate_hex_color],
        allow_blank=True
    )
    ballskin_image = serializers.ImageField(
        source='profile.ballskin_image', 
        required=False
    )
    gamebackground_color = serializers.CharField(
        source='profile.gamebackground_color', 
        required=False, 
        validators=[validate_hex_color],
        allow_blank=True
    )
    gamebackground_wallpaper = serializers.ImageField(
        source='profile.gamebackground_wallpaper', 
        required=False
    )
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'display_name', 'avatar', 'is_online', 'xp', 'is_2fa_enabled', 'level', 'xp_for_next_level', 'achievements',
            'paddleskin_color', 'paddleskin_image', 'achievements',
            'ballskin_color', 'ballskin_image',
            'gamebackground_color', 'gamebackground_wallpaper', 'is_ft_authenticated']
    
    
    def update(self, instance, validated_data):
        # Update User fields if they are included
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.save()

        # Update Profile fields
        profile_data = validated_data.get('profile', {})
        profile = instance.profile

        # Update display_name if present
        if 'display_name' in profile_data:
            profile.display_name = profile_data['display_name']
        
        # Update avatar if present
        if 'avatar' in profile_data:
            profile.avatar = profile_data['avatar']
        
        # Save the profile instance
        profile.save()

        return instance

    def get_xp_for_next_level(self, obj):
        """Get the XP required to reach the next level."""
        return obj.profile.xp_for_next_level()
    
    def get_friends(self, obj):
        friends_users = obj.friends.all()
        return UserDetailSerializer(friends_users, many=True, context=self.context).data

    def get_blocked_users(self, obj):
        blocked_profiles = obj.profile.blocked_users.all()
        blocked_users = [profile.user for profile in blocked_profiles]
        return UserDetailSerializer(blocked_users, many=True).data
    
    def get_achievements(self, obj):
        """
        Returns a list of the user's achievements serialized using AchievementSerializer.
        """
        user_achievements = obj.user_achievements.all().select_related('achievement')
        achievements = [ua.achievement for ua in user_achievements]
        return AchievementSerializer(achievements, many=True, context=self.context).data
    
class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    receiver = UserMinimalSerializer(read_only=True)
    room_id = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'sender',
            'receiver',
            'notification_type',
            'priority',
            'timestamp',
            'is_read',
            'data',
            'room_id'
        ]

    def get_room_id(self, obj):
        return obj.data.get('room_id', None)
    
class ChatMessageSerializer(serializers.ModelSerializer):
    sender = UserProfileSerializer(read_only=True)
    receiver = UserProfileSerializer(read_only=True)

    class Meta:
        model = ChatMessage
        fields = ['id', 'sender', 'receiver', 'message', 'timestamp', 'is_read']
        
class FriendRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = FriendRequest
        fields = ['id', 'sender', 'receiver', 'status', 'timestamp']
        
        
class SendGameInviteSerializer(serializers.Serializer):
    receiver_id = serializers.IntegerField()
    room_id = serializers.CharField()

    def validate_receiver_id(self, value):
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Receiver user does not exist.")
        return value

    def validate_room_id(self, value):
        if not Lobby.objects.filter(room_id=value).exists():
            raise serializers.ValidationError("Lobby with the given room_id does not exist.")
        return value
    
class FriendSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='profile.display_name', required=False)
    avatar = serializers.ImageField(source='profile.avatar', required=False)
    is_online = serializers.BooleanField(source='profile.is_online', read_only=True)
    xp = serializers.IntegerField(source='profile.xp', read_only=True)
    level = serializers.IntegerField(source='profile.level', read_only=True)
    xp_for_next_level = serializers.SerializerMethodField()
    achievements = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'display_name', 'avatar', 'is_online', 'xp', 'level', 'xp_for_next_level', 'achievements']
        
    def get_xp_for_next_level(self, obj):
        return obj.profile.xp_for_next_level()
    
    def get_achievements(self, obj):
        user_achievements = obj.user_achievements.all().select_related('achievement')
        achievements = [ua.achievement for ua in user_achievements]
        return AchievementSerializer(achievements, many=True, context=self.context).data
    
class AchievementSerializer(serializers.ModelSerializer):
    is_earned = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Achievement
        fields = ['id', 'name', 'description', 'points', 'is_earned', 'progress']

    def get_is_earned(self, obj):
        request = self.context.get('request', None)
        if request and hasattr(request, 'user'):
            user = request.user
            return UserAchievement.objects.filter(user=user, achievement=obj).exists()
        return False  # Default value if request is missing

    def get_progress(self, obj):
        request = self.context.get('request', None)
        if request and hasattr(request, 'user'):
            user = request.user
            profile = user.profile
            if obj.criteria_type == 'stat':
                user_stat_value = getattr(profile, obj.criteria_key, 0)
                
                # If user_stat_value is callable (method), call it to get the value
                if callable(user_stat_value):
                    try:
                        user_stat_value = user_stat_value()
                    except Exception as e:
                        return 0.0

                # Ensure that user_stat_value is a numeric type
                if not isinstance(user_stat_value, (int, float)):
                    return 0.0

                if obj.criteria_value:
                    try:
                        progress = user_stat_value / obj.criteria_value
                        return min(progress, 1.0)
                    except ZeroDivisionError:
                        return 0.0
                    except TypeError as e:
                        return 0.0
            elif obj.criteria_type == 'action':
                is_earned = UserAchievement.objects.filter(user=user, achievement=obj).exists()
                return 1.0 if is_earned else 0.0
        return 0.0  # Default value if request is missing