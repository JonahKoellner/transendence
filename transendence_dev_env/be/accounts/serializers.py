from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Profile, User, Notification, ChatMessage

class ProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(max_length=None, allow_empty_file=True, required=False)
    class Meta:
        model = Profile
        fields = ['display_name', 'avatar', 'is_2fa_enabled']
        read_only_fields = ['is_2fa_enabled']

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
    is_online = serializers.BooleanField(source='profile.is_online', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'display_name', 'avatar', 'friends', 'blocked_users', 'is_online']
        read_only_fields = ['friends', 'blocked_users', 'is_online']
        
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
        """
        Update User and Profile fields.
        """
        # Update User fields
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.save()

        # Update Profile fields
        profile_data = validated_data.get('profile', {})
        profile = instance.profile
        profile.display_name = profile_data.get('display_name', profile.display_name)
        if 'avatar' in profile_data:
            profile.avatar = profile_data['avatar']
        profile.save()

        return instance

class TokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()
    access = serializers.CharField()

class UserDetailSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source='profile.display_name', required=False)
    avatar = serializers.ImageField(source='profile.avatar', required=False)
    is_online = serializers.BooleanField(source='profile.is_online', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'display_name', 'avatar', 'is_online']
        read_only_fields = ['id', 'username', 'email', 'display_name', 'avatar', 'is_online']

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserDetailSerializer(read_only=True)
    receiver = UserDetailSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'sender', 'receiver', 'notification_type', 'priority', 'timestamp', 'is_read', 'data']
    
class ChatMessageSerializer(serializers.ModelSerializer):
    sender = UserProfileSerializer(read_only=True)
    receiver = UserProfileSerializer(read_only=True)

    class Meta:
        model = ChatMessage
        fields = ['id', 'sender', 'receiver', 'message', 'timestamp', 'is_read']