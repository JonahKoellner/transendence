from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Profile, User, Notification, ChatMessage, FriendRequest
from django.db import transaction
from games.models import Lobby
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
    is_2fa_enabled  = serializers.BooleanField(source='profile.is_2fa_enabled')
    has_logged_in = serializers.BooleanField(source='profile.has_logged_in')
    
    is_online = serializers.BooleanField(source='profile.is_online', read_only=True)
    
    xp = serializers.IntegerField(source='profile.xp', read_only=True)
    level = serializers.IntegerField(source='profile.level', read_only=True)
    xp_for_next_level = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'display_name', 'avatar', 'friends',
            'blocked_users', 'is_online', 'is_2fa_enabled', 'has_logged_in',
            'xp', 'level', 'xp_for_next_level'
        ]
        
    def get_friends(self, obj):
        """
        Returns a list of friends serialized using UserDetailSerializer.
        """
        friends_profiles = obj.profile.friends.all()
        friends_users = [profile.user for profile in friends_profiles]
        return UserDetailSerializer(friends_users, many=True).data
    
    def get_blocked_users(self, obj):
        """
        Returns a list of blocked users serialized using UserDetailSerializer.
        """
        blocked_profiles = obj.profile.blocked_users.all()
        blocked_users = [profile.user for profile in blocked_profiles]
        return UserDetailSerializer(blocked_users, many=True).data

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})

        # Use atomic transaction to ensure all or nothing
        with transaction.atomic():
            for attr, value in profile_data.items():
                setattr(instance.profile, attr, value)
            instance.profile.save()  # Commit all profile changes
            instance.save()  # Save the user instance

        return instance

    def get_xp_for_next_level(self, obj):
        """Get the XP required to reach the next level."""
        return obj.profile.xp_for_next_level()

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
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'display_name', 'avatar', 'is_online', 'xp', 'is_2fa_enabled', 'level', 'xp_for_next_level']
    
    
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