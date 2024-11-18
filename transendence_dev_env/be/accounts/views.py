from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.response import Response
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import ValidationError
import random
from .serializers import (
    RegisterSerializer, LoginSerializer, OTPVerifySerializer,
    TokenSerializer, UserProfileSerializer, NotificationSerializer,
    UserProfileSerializer, UserDetailSerializer, ChatMessageSerializer,
    FriendRequestSerializer, SendGameInviteSerializer, AchievementSerializer,
)
from .utils import create_notification, update_profile_with_transaction
from django.http import JsonResponse
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from .models import Notification, ChatMessage, FriendRequest, Achievement
from django.db import models
from django.db.models import Q
import be.settings as besettings
from games.models import Game, Lobby


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    
    def post(self, request):
        def get_cookie_settings():
            if besettings.DEBUG:
                return {'httponly': True, 'secure': False, 'samesite': 'Lax'}
            else:
                return {'httponly': True, 'secure': True, 'samesite': 'None'}
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)

            # Check if the profile exists; if not, raise an error
            try:
                profile = user.profile
            except ObjectDoesNotExist:
                raise ValidationError({"profile": "User profile does not exist."})

            # Retrieve the `is_2fa_enabled` attribute from the user's profile
            is_2fa_enabled = profile.is_2fa_enabled

            # Response data
            data = {
                'access': access_token,
                'refresh': str(refresh),
                'is_2fa_enabled': is_2fa_enabled
            }

            if not is_2fa_enabled or not profile.has_logged_in:
                otp_uri = profile.generate_otp()
                if otp_uri:
                    data['otp_uri'] = otp_uri

            response = Response(data)

            # Set refresh token in HttpOnly cookie
            try:
                cookie_settings = get_cookie_settings()

                response.set_cookie(
                    'refresh_token',
                    str(refresh),
                    max_age=api_settings.REFRESH_TOKEN_LIFETIME.total_seconds(),
                    httponly=cookie_settings['httponly'],
                    secure=cookie_settings['secure'],
                    samesite=cookie_settings['samesite']
                )
                print("Refresh token cookie set successfully")
            except Exception as e:
                print("Error setting refresh token cookie:", e)

            return response
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        try:
            refresh_token = request.COOKIES.get('refresh_token')
            print("Received refresh token from cookies during logout:", refresh_token)

            if refresh_token is None:
                print("No refresh token found in cookies.")
                return Response({"message": "Refresh token not found"}, status=status.HTTP_400_BAD_REQUEST)
            
            token = RefreshToken(refresh_token)
            token.blacklist()  # Blacklist the refresh token
            
            # Create the logout response
            response = Response({"message": "Logout successful"}, status=status.HTTP_205_RESET_CONTENT)
            response.delete_cookie('refresh_token')
            print("Refresh token blacklisted and cookie cleared.")
            return response

        except Exception as e:
            print("Error during logout:", e)
            return Response({"message": "Invalid refresh token or error in logout"}, status=status.HTTP_400_BAD_REQUEST)
        
class Enable2FAView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        user = request.user
        profile = user.profile

        if not profile.is_2fa_enabled:
            # Generate OTP secret and enable 2FA
            otp_uri = profile.generate_otp()  # This generates and saves the OTP secret
            profile.is_2fa_enabled = True  # Enable 2FA
            profile.save()

            return Response({
                'otp_uri': otp_uri,
                'message': '2FA enabled successfully'
            }, status=status.HTTP_200_OK)
        else:
            return Response({'message': '2FA is already enabled'}, status=status.HTTP_400_BAD_REQUEST)

    
class Disable2FAView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        user = request.user
        profile = user.profile

        if profile.is_2fa_enabled:
            # Disable 2FA by resetting the OTP secret and flag
            profile.otp_secret = None  # Remove the OTP secret
            profile.is_2fa_enabled = False  # Disable 2FA
            profile.save()

            return Response({'message': '2FA disabled successfully'}, status=status.HTTP_200_OK)
        else:
            return Response({'message': '2FA is not enabled'}, status=status.HTTP_400_BAD_REQUEST)


class VerifyOTPView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        if serializer.is_valid():
            otp_code = serializer.validated_data['otp_code']


            # Verify the OTP code using the user's profile
            if request.user.profile.verify_otp(otp_code):
                request.user.profile.is_2fa_enabled = True  # Enable 2FA
                request.user.profile.save()

                return Response({"success": True, "message": "OTP verified successfully, 2FA is now enabled"}, status=status.HTTP_200_OK)
            
            return Response({"success": False, "message": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TokenRefreshView(SimpleJWTTokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response({"message": "Refresh token not found"}, status=status.HTTP_401_UNAUTHORIZED)
        
        serializer = self.get_serializer(data={'refresh': refresh_token})
        serializer.is_valid(raise_exception=True)
        
        # Set new tokens
        access_token = serializer.validated_data['access']
        new_refresh_token = serializer.validated_data.get('refresh')
        response_data = {'access': access_token}
        response = Response(response_data)
        
        # Update refresh token cookie if rotated
        if api_settings.ROTATE_REFRESH_TOKENS and new_refresh_token:
            response.set_cookie(
                'refresh_token',
                new_refresh_token,
                max_age=api_settings.REFRESH_TOKEN_LIFETIME.total_seconds(),
                httponly=True,
                secure=False,
                samesite='Lax' if besettings.DEBUG else 'None'
            )
        return response

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_class(self):
        # Use UserProfileSerializer for detailed views and UserDetailSerializer for others
        if self.action in ['retrieve', 'update', 'partial_update']:
            return UserProfileSerializer
        return UserDetailSerializer

    def list(self, request, *args, **kwargs):
        """
        Override the list method to return only the authenticated user's data.
        """
        user = self.get_queryset().get(id=request.user.id)  # Retrieve fresh instance
        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        """
        Override the update method to handle profile updates using the serializer.
        """
        user = self.get_object()  # Retrieves the user instance based on the URL
        serializer = self.get_serializer(user, data=request.data, partial=True)  # Set partial=True if you want to allow partial updates

        if serializer.is_valid():
            serializer.save()  # This invokes the serializer's update method
            return Response({"message": "Profile updated successfully"}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='search')
    def search_users(self, request):
        query = request.query_params.get('q', '')
        users = User.objects.filter(username__icontains=query).exclude(id=request.user.id)
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path=r'profile_color/(?P<user_id>\d+)')
    def profile_color(self, request, user_id=None):
        """
        Endpoint to retrieve the user's profile color based on calculated stats by user_id.
        """
        user = get_object_or_404(User, id=user_id)  # Fetch user by ID
        profile = user.profile
        color = profile.calculate_profile_color()
        return Response({'profile_color': color}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='friend-requests')
    def friend_requests(self, request):
        """
        Get all friend requests sent by and received by the authenticated user.
        """
        # Filter friend requests where the user is either the sender or the receiver
        sent_requests = FriendRequest.objects.filter(sender=request.user)
        received_requests = FriendRequest.objects.filter(receiver=request.user)

        # Combine the sent and received requests
        all_requests = sent_requests | received_requests

        # Serialize the friend requests
        serializer = FriendRequestSerializer(all_requests, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='send-friend-request')
    def send_friend_request(self, request, pk=None):
        """
        Send a friend request to another user.
        """
        user_to_add = get_object_or_404(User, pk=pk)

        # Prevent sending a request to oneself
        if user_to_add == request.user:
            return Response({'detail': 'You cannot send a friend request to yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        
        sender_profile = request.user.profile
        receiver_profile = user_to_add.profile

        # Check if they are already friends
        if receiver_profile in sender_profile.friends.all():
            return Response({'detail': 'You are already friends with this user.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if the user is blocked
        if receiver_profile in sender_profile.blocked_users.all() or sender_profile in receiver_profile.blocked_users.all():
            return Response({'detail': 'You cannot send a friend request to a blocked user.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if a friend request already exists in either direction
        
        try:
            existing_request = FriendRequest.objects.filter(
                (Q(sender=request.user) & Q(receiver=user_to_add)) | 
                (Q(sender=user_to_add) & Q(receiver=request.user))
            ).first()
            if existing_request:
                if existing_request.status == FriendRequest.ACCEPTED:
                    return Response({'detail': 'You are already friends with this user.'}, status=status.HTTP_400_BAD_REQUEST)
            # elif existing_request.status == FriendRequest.PENDING: TODO FIX THIS
            #     return Response({'detail': 'Friend request already sent.'}, status=status.HTTP_400_BAD_REQUEST)
        # Create a friend request
        except Exception as e:
            return Response({'detail': 'Cant send friend request.'}, status=status.HTTP_400_BAD_REQUEST)
        friend_request = FriendRequest.objects.create(sender=request.user, receiver=user_to_add)

        # Create a notification for the receiver
        create_notification(
            sender=request.user,
            receiver=user_to_add,
            notification_type='friend_request',
            data={'message': f'{request.user.username} sent you a friend request.', 'friend_request_id': friend_request.id},
            priority='medium'
        )

        return Response({'status': 'Friend request sent.', 'friend_request_id': friend_request.id})


    @action(detail=True, methods=['post'], url_path='accept-request')
    def accept_friend_request(self, request, pk=None):
        """
        Accept a friend request from a user.
        """
        friend_request = get_object_or_404(FriendRequest, pk=pk, receiver=request.user, status=FriendRequest.PENDING)

        # Access profiles
        sender_profile = friend_request.sender.profile
        receiver_profile = friend_request.receiver.profile

        # Add the receiver's profile to sender's friends
        sender_profile.friends.add(receiver_profile)
        # Add the sender's profile to receiver's friends
        receiver_profile.friends.add(sender_profile)

        # Update the friend request status
        friend_request.status = FriendRequest.ACCEPTED
        friend_request.save()
        
        # Create a notification for the sender that the request was accepted
        create_notification(
            sender=request.user,
            receiver=friend_request.sender,
            notification_type='friend_request_accepted',
            data={'message': f'{request.user.username} accepted your friend request.'},
            priority='medium'
        )

        return Response({'status': 'Friend request accepted.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject-request')
    def reject_friend_request(self, request, pk=None):
        """
        Reject a pending friend request.
        """
        friend_request = get_object_or_404(FriendRequest, pk=pk, receiver=request.user, status=FriendRequest.PENDING)
        friend_request.delete()
        
        # Optionally create a notification to inform the sender that the request was rejected
        create_notification(
            sender=request.user,
            receiver=friend_request.sender,
            notification_type='friend_request_rejected',
            data={'message': f'{request.user.username} declined your friend request.'},
            priority='medium'
        )

        return Response({'status': 'Friend request rejected.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='remove-friend')
    def remove_friend(self, request, pk=None):
        """
        Unfriend a user.
        """
        user_to_remove = get_object_or_404(User, pk=pk)

        sender_profile = request.user.profile
        receiver_profile = user_to_remove.profile

        # Check if they are friends
        if receiver_profile not in sender_profile.friends.all():
            return Response({'detail': 'You are not friends with this user.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove the receiver's profile from sender's friends
        sender_profile.friends.remove(receiver_profile)
        # Remove the sender's profile from receiver's friends
        receiver_profile.friends.remove(sender_profile)

        # Check if a friend request already exists in either direction and delete it
        try:
            FriendRequest.objects.filter(
                (Q(sender=request.user) & Q(receiver=user_to_remove)) | 
                (Q(sender=user_to_remove) & Q(receiver=request.user))
            ).delete()
        except Exception as e:
            return Response({'detail': 'User cant be unfriended.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'Friend removed.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='block-user')
    def block_user(self, request, pk=None):
        """
        Block a user.
        """
        user_to_block = get_object_or_404(User, pk=pk)

        sender_profile = request.user.profile
        receiver_profile = user_to_block.profile

        # Prevent blocking oneself
        if user_to_block == request.user:
            return Response({'detail': 'You cannot block yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if already blocked
        if receiver_profile in sender_profile.blocked_users.all():
            return Response({'detail': 'User already blocked.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove from friends if they are friends
        if receiver_profile in sender_profile.friends.all():
            sender_profile.friends.remove(receiver_profile)
            receiver_profile.friends.remove(sender_profile)
        
        # Block the receiver's profile
        sender_profile.blocked_users.add(receiver_profile)

        # Check if a friend request already exists in either direction and delete it
        try: 
            FriendRequest.objects.filter(
                (Q(sender=request.user) & Q(receiver=user_to_block)) | 
                (Q(sender=user_to_block) & Q(receiver=request.user))
            ).delete()
        except Exception as e:
            return Response({'detail': 'User cant be blocked.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'status': 'User blocked and removed from friends.'}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='blocked-users')
    def list_blocked_users(self, request):
        """
        List all users blocked by the authenticated user.
        """
        sender_profile = request.user.profile
        blocked_profiles = sender_profile.blocked_users.all()
        blocked_users = [profile.user for profile in blocked_profiles]
        serializer = UserDetailSerializer(blocked_users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unblock-user')
    def unblock_user(self, request, pk=None):
        """
        Unblock a user.
        """
        user_to_unblock = get_object_or_404(User, pk=pk)
        sender_profile = request.user.profile
        receiver_profile = user_to_unblock.profile

        # Check if the user is currently blocked
        if receiver_profile not in sender_profile.blocked_users.all():
            return Response({'detail': 'User is not in your blocked list.'}, status=status.HTTP_400_BAD_REQUEST)

        # Remove the receiver's profile from the blocked users
        sender_profile.blocked_users.remove(receiver_profile)

        return Response({'status': 'User unblocked successfully.'}, status=status.HTTP_200_OK)
    @action(detail=False, methods=['get'], url_path='friends')
    def list_friends(self, request):
        """
        List all friends of the authenticated user.
        """
        sender_profile = request.user.profile
        friends_profiles = sender_profile.friends.all()
        friends_users = [profile.user for profile in friends_profiles]
        serializer = UserDetailSerializer(friends_users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        return Notification.objects.filter(receiver=self.request.user)

    @action(detail=True, methods=['post'], url_path='mark-as-read')
    def mark_as_read(self, request, pk=None):
        notification = get_object_or_404(Notification, pk=pk, receiver=request.user)
        notification.is_read = True
        notification.save()
        return Response({'status': 'Notification marked as read.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all-as-read')
    def mark_all_as_read(self, request):
        notifications = Notification.objects.filter(receiver=request.user, is_read=False)
        notifications.update(is_read=True)
        return Response({'status': 'All notifications marked as read.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='delete')
    def delete_notification(self, request, pk=None):
        notification = get_object_or_404(Notification, pk=pk, receiver=request.user)
        notification.delete()
        return Response({'status': 'Notification deleted successfully.'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['delete'], url_path='clear-all')
    def clear_all_notifications(self, request):
        Notification.objects.filter(receiver=request.user).delete()
        return Response({'status': 'All notifications cleared.'}, status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['get'], url_path='by-type')
    def get_notifications_by_type(self, request):
        notification_type = request.query_params.get('type')
        if notification_type not in dict(Notification.NOTIFICATION_TYPES).keys():
            return Response({'error': 'Invalid notification type.'}, status=status.HTTP_400_BAD_REQUEST)
        
        notifications = Notification.objects.filter(receiver=request.user, notification_type=notification_type)
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='send-game-invite')
    def send_game_invite(self, request):
        serializer = SendGameInviteSerializer(data=request.data)
        if serializer.is_valid():
            receiver_id = serializer.validated_data['receiver_id']
            room_id = serializer.validated_data['room_id']

            sender_user = request.user

            # Retrieve the receiver user
            try:
                receiver_user = User.objects.get(id=receiver_id)
            except User.DoesNotExist:
                return Response({'detail': 'Receiver user does not exist.'}, status=status.HTTP_404_NOT_FOUND)

            # Retrieve the lobby instance using room_id
            try:
                lobby = Lobby.objects.get(room_id=room_id)
            except Lobby.DoesNotExist:
                return Response({'detail': 'Lobby does not exist.'}, status=status.HTTP_404_NOT_FOUND)

            if lobby.host == receiver_user:
                return Response({'detail': 'Cannot send game invite to the host of the Lobby.'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if the receiver is already part of a Game in the Lobby
            if Game.objects.filter(lobby=lobby, player2=receiver_user).exists() or \
               Game.objects.filter(lobby=lobby, player1=receiver_user).exists():
                return Response({'detail': 'User is already part of a game in this Lobby.'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if the receiver is a friend
            if not sender_user.profile.friends.filter(id=receiver_user.profile.id).exists():
                return Response({'detail': 'You can only send game invites to your friends.'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if the receiver has blocked the sender or vice versa
            if sender_user.profile.blocked_users.filter(id=receiver_user.profile.id).exists() or \
               receiver_user.profile.blocked_users.filter(id=sender_user.profile.id).exists():
                return Response({'detail': 'Cannot send game invite to this user.'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if there is already a pending game invite to this Lobby for this receiver
            existing_invites = Notification.objects.filter(
                sender=sender_user,
                receiver=receiver_user,
                notification_type='game_invite',
                is_read=False,
                data__room_id=room_id
            )
            if existing_invites.exists():
                return Response({'detail': 'A pending game invite already exists for this user in this Lobby.'}, status=status.HTTP_400_BAD_REQUEST)

            # Create the game invite notification
            create_notification(
                sender=sender_user,
                receiver=receiver_user,
                notification_type='game_invite',
                data={
                    'message': f'{sender_user.username} has invited you to join Lobby {room_id}.',
                    'room_id': room_id
                },
                priority='high'
            )

            return Response({'status': 'Game invite sent successfully.'}, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        
class ChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    # This method defines the base queryset for the viewset.
    def get_queryset(self):
        return ChatMessage.objects.filter(
            models.Q(sender=self.request.user) | models.Q(receiver=self.request.user)
        )

    # Action to send a new message
    @action(detail=False, methods=['post'], url_path='send')
    def send_message(self, request):
        receiver_id = request.data.get('receiver_id')
        message_text = request.data.get('message')
        receiver = get_object_or_404(User, pk=receiver_id)

        # Check if the receiver has blocked the sender or vice versa
        if receiver in request.user.profile.blocked_users.all() or request.user in receiver.profile.blocked_users.all():
            return Response({'detail': 'Cannot send message to this user.'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent sending messages to self
        if receiver == request.user:
            return Response({'detail': 'Cannot send message to yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure the message is not empty
        if not message_text:
            return Response({'detail': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        # Allow messaging only between friends
        if receiver.profile not in request.user.profile.friends.all():
            return Response({'detail': 'Cannot send message to this user.'}, status=status.HTTP_400_BAD_REQUEST)

        message = ChatMessage.objects.create(
            sender=request.user,
            receiver=receiver,
            message=message_text
        )

        # Optionally, create a notification for the receiver about the new message
        create_notification(sender=request.user, receiver=receiver, notification_type='new_message', data={'message': message_text})

        return Response(ChatMessageSerializer(message, context={'request': request}).data, status=status.HTTP_201_CREATED)

    # Action to retrieve chat history between two users
    @action(detail=False, methods=['get'], url_path='history')
    def chat_history(self, request):
        # Get the ID of the other user from the query params
        other_user_id = request.query_params.get('user_id')
        other_user = get_object_or_404(User, id=other_user_id)

        # Fetch messages between the logged-in user and the specified user
        messages = ChatMessage.objects.filter(
            models.Q(sender=request.user, receiver=other_user) |
            models.Q(sender=other_user, receiver=request.user)
        ).order_by('timestamp')

        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class AchievementListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        achievements = Achievement.objects.all()
        serializer = AchievementSerializer(achievements, many=True, context={'request': request})
        return Response(serializer.data)