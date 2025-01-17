from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.response import Response
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db import transaction
from datetime import timedelta
from django.core.exceptions import ObjectDoesNotExist
from rest_framework.exceptions import ValidationError
from .serializers import (
    RegisterSerializer, LoginSerializer, OTPVerifySerializer,
    NotificationSerializer,
    UserProfileSerializer, UserDetailSerializer, ChatMessageSerializer,
    FriendRequestSerializer, SendGameInviteSerializer, AchievementSerializer, PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    SendArenaGameInviteSerializer, SendChaosGameInviteSerializer
)
from .utils import create_notification
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from .models import Notification, ChatMessage, FriendRequest, Achievement, UserAchievement, Profile
from django.db import models
from django.db.models import Count, Q, F, Sum, Avg
import be.settings as besettings
from games.models import Game, Lobby, Tournament, ArenaLobby, ChaosLobby, OnlineTournament
from django.utils import timezone
from django.contrib.auth.tokens import PasswordResetTokenGenerator
import logging
from django.utils.http import urlsafe_base64_encode
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
logger = logging.getLogger('accounts')
from anymail.message import AnymailMessage
from django.conf import settings
import hvac
class PasswordResetRequestView(APIView):
    """
    Handle password reset requests by sending an email with a reset link.
    """
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            user = User.objects.get(email=email)
            token_generator = PasswordResetTokenGenerator()
            token = token_generator.make_token(user)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            reset_url = f"{settings.FRONTEND_DOMAIN}/reset-password?uidb64={uidb64}&token={token}"
            
            subject = "Password Reset Requested"
            context = {
                'user': user,
                'reset_url': reset_url,
            }
            # Render HTML and plain text versions
            text_content = render_to_string('accounts/password_reset_email.txt', context)
            html_content = render_to_string('accounts/password_reset_email.html', context)
            
            try:
                message = AnymailMessage(
                    subject=subject,
                    body=text_content,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[email],
                )
                message.attach_alternative(html_content, "text/html")
                message.send()
                logger.info(f"Password reset email sent to {email}")
                return Response({"message": "Password reset email sent"}, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error sending password reset email to {email}: {e}")
                return Response({"error": "Error sending email"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            logger.warning(f"Invalid password reset request data: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmView(APIView):
    """
    Handle password reset confirmations by setting a new password.
    """
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            new_password = serializer.validated_data['new_password']
            user.set_password(new_password)
            user.save()
            logger.info(f"Password reset successfully for user {user.email}")
            return Response({"message": "Password has been reset successfully"}, status=status.HTTP_200_OK)
        else:
            logger.warning(f"Invalid password reset confirmation data: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    
    def check_need_to_revalidate_2fa(self, request, user):
        """
        Determine if the user needs to revalidate 2FA based on various factors.
        """
        profile = user.profile

        # Current login details
        current_ip = self.get_client_ip(request)
        current_user_agent = request.META.get('HTTP_USER_AGENT', '')

        # Previous login details
        last_login = profile.last_login
        last_ip = profile.last_login_ip
        last_user_agent = profile.last_user_agent

        # If no previous login data, require 2FA
        if not last_login or not last_ip or not last_user_agent:
            return True

        # Check for IP address change
        ip_changed = current_ip != last_ip

        # Check for User Agent change
        user_agent_changed = current_user_agent != last_user_agent

        # Time since last login (e.g., revalidate if more than 24 hours)
        time_difference = timezone.now() - last_login
        time_exceeded = time_difference.total_seconds() > 24 * 60 * 60  # 24 hours

        # Require 2FA revalidation if any condition is met
        if ip_changed or user_agent_changed or time_exceeded:
            return True

        return False

    def get_client_ip(self, request):
        """
        Helper method to get the client's IP address from the request.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
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
            if is_2fa_enabled and self.check_need_to_revalidate_2fa(request, user):
                # If 2FA is enabled and the user needs to revalidate, return a 401 status code
                return Response({"message": "2FA revalidation required", 'access': access_token}, status=status.HTTP_401_UNAUTHORIZED)
            profile.last_login = timezone.now()
            profile.last_login_ip = self.get_client_ip(request)
            profile.last_user_agent = request.META.get('HTTP_USER_AGENT', '')
            

            # Response data
            data = {
                'access': access_token,
                'refresh': str(refresh),
                'is_2fa_enabled': is_2fa_enabled,
                'has_logged_in': profile.has_logged_in
            }

            if not is_2fa_enabled and not profile.has_logged_in:
                otp_uri = profile.generate_otp()
                if otp_uri:
                    data['otp_uri'] = otp_uri
            profile.has_logged_in = True
            profile.save()
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
    
    def get_client_ip(self, request):
        """
        Helper method to get the client's IP address from the request.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        if serializer.is_valid():
            otp_code = serializer.validated_data['otp_code']


            # Verify the OTP code using the user's profile
            if request.user.profile.verify_otp(otp_code):
                request.user.profile.is_2fa_enabled = True  # Enable 2FA
                request.user.profile.last_login = timezone.now()
                request.user.profile.last_login_ip = self.get_client_ip(request)
                request.user.profile.last_user_agent = request.META.get('HTTP_USER_AGENT', '')
                request.user.profile.save()

                return Response({"success": True, "message": "OTP verified successfully, 2FA is now enabled"}, status=status.HTTP_200_OK)
            
            return Response({"success": False, "message": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TokenRefreshView(SimpleJWTTokenRefreshView):
    def post(self, request, *args, **kwargs):
        logger.debug("Received JWT refresh request")
        refresh_token = request.COOKIES.get('refresh_token')

        # If no refresh token is found, return a 401 Unauthorized response
        if not refresh_token:
            logger.debug("No refresh token found in TokenRefreshView")
            return Response(
                {"message": "Refresh token not found"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            # Attempt to validate the refresh token using the serializer
            serializer = self.get_serializer(data={'refresh': refresh_token})
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as ve:
            # Validation errors (e.g., invalid or expired token) result in a 401 response
            logger.error("Invalid refresh token", exc_info=ve)
            return Response(
                {"message": "Invalid refresh token"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            # Catch-all for any other unexpected errors
            logger.exception("Unexpected error during token refresh")
            return Response(
                {"message": "Unexpected error during token refresh"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # If validation succeeds, proceed to set new tokens
        access_token = serializer.validated_data.get('access')
        new_refresh_token = serializer.validated_data.get('refresh')
        response_data = {'access': access_token}
        response = Response(response_data)

        # Update refresh token cookie if rotation is enabled and a new token is provided
        if api_settings.ROTATE_REFRESH_TOKENS and new_refresh_token:
            logger.debug("Rotating JWT refresh token")
            response.set_cookie(
                'refresh_token',
                new_refresh_token,
                max_age=int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
                httponly=True,
                secure=False,
                samesite='Lax'  # Adjust based on your DEBUG settings if needed
            )

        logger.debug(f"Sending new access token: {response_data}")
        return response

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return UserProfileSerializer
        elif self.action == 'retrieve':
            return UserProfileSerializer
        return UserDetailSerializer  # Use for other actions if necessary

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
    
    @action(detail=False, methods=['delete'], url_path='delete')
    def delete_account(self, request):
        """
        Custom action to delete the authenticated user's account.
        """
        user = request.user
        password = request.data.get('password')

        if not password:
            return Response({"message": "Password is required to delete the account."}, status=status.HTTP_400_BAD_REQUEST)

        # Authenticate the user with the provided password
        user_auth = authenticate(username=user.username, password=password)
        if user_auth is None:
            return Response({"message": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                refresh = RefreshToken.for_user(user)
                refresh.blacklist()

                # Delete or anonymize related data
                self.delete_related_data(user)

                # Finally, delete the user
                user.delete()

            return Response({"message": "Your account has been deleted successfully."}, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Error deleting account: {e}")
            return Response({"message": "An error occurred while deleting your account."}, status=status.HTTP_400_BAD_REQUEST)

    def delete_related_data(self, user):
        """
        Deletes or anonymizes all related data for the user.
        """
        # Delete Profile
        try:
            profile = user.profile
            profile.delete()
        except ObjectDoesNotExist:
            pass

        # Delete Notifications
        Notification.objects.filter(sender=user).delete()
        Notification.objects.filter(receiver=user).delete()

        # Delete Chat Messages
        ChatMessage.objects.filter(sender=user).delete()
        ChatMessage.objects.filter(receiver=user).delete()

        # Delete Achievements
        UserAchievement.objects.filter(user=user).delete()

        # Delete Lobbies Hosted or Joined
        Lobby.objects.filter(host=user).delete()
        Lobby.objects.filter(guest=user).delete()

        # Delete Tournaments Hosted
        Tournament.objects.filter(host=user).delete()

        # Delete Games Played
        Game.objects.filter(player1=user).delete()
        Game.objects.filter(player2=user).delete()

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

        #handle already sent friend request
        existing_request = FriendRequest.objects.filter(
            (Q(sender=request.user) & Q(receiver=user_to_add)) | 
            (Q(sender=user_to_add) & Q(receiver=request.user))
        ).first()
        if existing_request:
            if existing_request.status == FriendRequest.PENDING:
                return Response({'detail': 'Friend request already sent.'}, status=status.HTTP_400_BAD_REQUEST)
            elif existing_request.status == FriendRequest.ACCEPTED:
                return Response({'detail': 'You are already friends with this user.'}, status=status.HTTP_400_BAD_REQUEST)

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
                    'room_id': room_id,
                    'game_type': "classic"
                },
                priority='high'
            )

            return Response({'status': 'Game invite sent successfully.'}, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        
    @action(detail=False, methods=['post'], url_path='send-game-invite-arena')
    def send_game_invite_arena(self, request):
        serializer = SendArenaGameInviteSerializer(data=request.data)
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
                lobby = ArenaLobby.objects.get(room_id=room_id)
            except ArenaLobby.DoesNotExist:
                return Response({'detail': 'Lobby does not exist.'}, status=status.HTTP_404_NOT_FOUND)

            if lobby.player_one == receiver_user:
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
                    'room_id': room_id,
                    'game_type': "arena"
                },
                priority='high'
            )

            return Response({'status': 'Game invite sent successfully.'}, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=False, methods=['post'], url_path='send-game-invite-chaos')
    def send_game_invite_chaos(self, request):
        serializer = SendChaosGameInviteSerializer(data=request.data)
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
                chaosLobby = ChaosLobby.objects.get(room_id=room_id)
            except ChaosLobby.DoesNotExist:
                return Response({'detail': 'Lobby does not exist.'}, status=status.HTTP_404_NOT_FOUND)

            if chaosLobby.host == receiver_user:
                return Response({'detail': 'Cannot send game invite to the host of the Lobby.'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if the receiver is already part of a Game in the Lobby
            if Game.objects.filter(lobby=chaosLobby, player2=receiver_user).exists() or \
               Game.objects.filter(lobby=chaosLobby, player1=receiver_user).exists():
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
                    'room_id': room_id,
                    'game_type': "chaos"
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
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        achievements = Achievement.objects.all()
        serializer = AchievementSerializer(achievements, many=True, context={'request': request})
        return Response(serializer.data)

    
class HashiView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
            # Vault configuration
        VAULT_ADDR = 'https://hashicorpvault:8200'
        VAULT_CACERT = '/home/vault-data/vault.crt'
        try:
            with open('/home/vault-data/vault_token.tok', 'r') as f:
                VAULT_TOKEN = f.read().strip()
        except Exception as e:
            return Response({'error': f'Error reading Vault token: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST)

        # Initialize the Vault client
        client = hvac.Client(
            url=VAULT_ADDR,
            token=VAULT_TOKEN,
            verify=VAULT_CACERT
        )

        # Path to the secret
        secret_path = 'ft_secrets'

        try:
            # Read the secret from Vault
            secret_response = client.secrets.kv.v2.read_secret_version(path=secret_path)
            secret_data = secret_response['data']['data']
            # print(secret_data)
            logger.info(f'Successfully retrieved secret: {secret_data}')
            return Response(secret_data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class UserStatsView(APIView):
    """
    API view to retrieve user statistics for display on the user detail page.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, user_id):
        """
        Handle GET request to retrieve user statistics.
        """
        try:

            # Fetch the user profile with related user data
            profile = get_object_or_404(Profile.objects.select_related('user'), user__id=user_id)

            # Current date
            today = timezone.now().date()

            # Define the date range (last 12 months)
            start_date = today - timedelta(days=365)

            # Helper function to generate last 12 month labels accurately
            def get_last_12_months():
                months = []
                year = today.year
                month = today.month
                for _ in range(12):
                    months.append(f"{year}-{month:02}")
                    month -= 1
                    if month == 0:
                        month = 12
                        year -= 1
                return sorted(months)

            # 1. Games Played Over Time (Last 12 Months)
            games_played = Game.objects.filter(
                Q(player1=profile.user) |
                Q(player2=profile.user) |
                Q(player3=profile.user) |
                Q(player4=profile.user),
                start_time__date__gte=start_date
            ).annotate(month=F('start_time__month'), year=F('start_time__year')) \
             .values('year', 'month') \
             .annotate(count=Count('id')) \
             .order_by('year', 'month')

            # Organize data per month
            games_played_dict = {}
            for entry in games_played:
                month_year = f"{entry['year']}-{entry['month']:02}"
                games_played_dict[month_year] = entry['count']

            # Generate last 12 months
            last_12_months = get_last_12_months()
            games_played_final = []
            for month in last_12_months:
                games_played_final.append({
                    "month": month,
                    "count": games_played_dict.get(month, 0)
                })

            # 2. Win/Loss Ratio
            total_wins = Game.objects.filter(winner=profile.user).count()
            total_losses = Game.objects.filter(
                Q(player1=profile.user) |
                Q(player2=profile.user) |
                Q(player3=profile.user) |
                Q(player4=profile.user),
                ~Q(winner=profile.user)
            ).count()

            win_loss_ratio = {
                "wins": total_wins,
                "losses": total_losses
            }

            # 3. Game Modes Distribution
            game_modes = Game.GAME_MODES
            game_mode_distribution = {}
            for mode, _ in game_modes:
                count = Game.objects.filter(game_mode=mode).filter(
                    Q(player1=profile.user) |
                    Q(player2=profile.user) |
                    Q(player3=profile.user) |
                    Q(player4=profile.user)
                ).count()
                game_mode_distribution[mode] = count

            # 4. Time Spent Playing Over Time (Last 12 Months)
            time_spent = Game.objects.filter(
                Q(player1=profile.user) |
                Q(player2=profile.user) |
                Q(player3=profile.user) |
                Q(player4=profile.user),
                start_time__date__gte=start_date,
                duration__isnull=False
            ).annotate(month=F('start_time__month'), year=F('start_time__year')) \
             .values('year', 'month') \
             .annotate(total_minutes=Sum('duration')) \
             .order_by('year', 'month')

            # Organize data per month
            time_spent_dict = {}
            for entry in time_spent:
                month_year = f"{entry['year']}-{entry['month']:02}"
                time_spent_dict[month_year] = entry['total_minutes']

            # Prepare final data
            time_spent_final = []
            for month in last_12_months:
                time_spent_final.append({
                    "month": month,
                    "total_minutes": time_spent_dict.get(month, 0)
                })

            # 5. Tournaments Participated vs. Won
            # Local
            tournaments_participated = Tournament.objects.filter(
                host=profile.user
            ).count()
            tournaments_won = Tournament.objects.filter(
                final_winner=profile.user
            ).count()

            # Online
            participated_tmp = OnlineTournament.objects.filter(
                participants=profile.user
            ).count()
            logger.info(f"online tournaments participated by {profile.user.username}: {participated_tmp}")
            tournaments_participated += participated_tmp
            
            won_tmp = OnlineTournament.objects.filter(
                final_winner = profile.user
            ).count()
            logger.info(f"online tournaments won by {profile.user.username}: {won_tmp}")
            tournaments_won += won_tmp
            
            tournaments_stats = {
                "participated": tournaments_participated,
                "won": tournaments_won
            }

            # 6. Preferred Playing Times Over the Day (Last 12 Months)
            preferred_playing_times = Game.objects.filter(
                Q(player1=profile.user) |
                Q(player2=profile.user) |
                Q(player3=profile.user) |
                Q(player4=profile.user),
                start_time__date__gte=start_date
            ).annotate(hour=F('start_time__hour')) \
             .values('hour') \
             .annotate(count=Count('id')) \
             .order_by('hour')

            # Organize data per hour
            playing_times_dict = {hour: 0 for hour in range(24)}
            for entry in preferred_playing_times:
                playing_times_dict[entry['hour']] = entry['count']

            # Prepare data for chart
            preferred_playing_times_final = []
            for hour in range(24):
                preferred_playing_times_final.append({
                    "hour": f"{hour}:00 - {hour}:59",
                    "count": playing_times_dict[hour]
                })

            # Prepare final JSON response
            data = {
                "games_played_over_time": games_played_final,
                "win_loss_ratio": win_loss_ratio,
                "game_modes_distribution": game_mode_distribution,
                "time_spent_playing_over_time": time_spent_final,
                "tournaments_stats": tournaments_stats,
                "preferred_playing_times": preferred_playing_times_final
            }

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in UserStatsView GET: {e}")
            return Response(
                {"detail": "An unexpected error occurred."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
class GlobalStatsView(APIView):
    """
    API view to retrieve global statistics for display on the global dashboard.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        """
        Handle GET request to retrieve global statistics.
        """
        try:
            # Current date
            today = timezone.now().date()

            # Define the date range (last 12 months)
            start_date = today - timedelta(days=365)

            # Helper function to generate last 12 month labels accurately
            def get_last_12_months():
                months = []
                year = today.year
                month = today.month
                for _ in range(12):
                    months.append(f"{year}-{month:02}")
                    month -= 1
                    if month == 0:
                        month = 12
                        year -= 1
                return sorted(months)

            last_12_months = get_last_12_months()

            # 1. Games Played per Mode
            games_per_mode = Game.objects.values('game_mode').annotate(count=Count('id')).order_by('-count')
            games_per_mode_data = {entry['game_mode']: entry['count'] for entry in games_per_mode}

            # 2. Peak Playing Times (Games started per hour)
            games_per_hour = Game.objects.extra(select={'hour': 'EXTRACT(HOUR FROM start_time)'}).values('hour').annotate(count=Count('id')).order_by('hour')
            games_per_hour_dict = {int(entry['hour']): entry['count'] for entry in games_per_hour}

            # Initialize all hours with zero counts
            peak_playing_times = [{"hour": f"{hour}:00 - {hour}:59", "count": games_per_hour_dict.get(hour, 0)} for hour in range(24)]

            # 3. Game Modes Popularity
            # Similar to Games Played per Mode but expressed as percentages
            total_games = Game.objects.count()
            game_modes_popularity = [
                {
                    "mode": entry['game_mode'],
                    "percentage": round((entry['count'] / total_games) * 100, 2) if total_games > 0 else 0
                }
                for entry in games_per_mode
            ]

            # 4. Games Played Globally Over Time (Last 12 Months)
            games_over_time = Game.objects.filter(start_time__date__gte=start_date) \
                .annotate(month=F('start_time__month'), year=F('start_time__year')) \
                .values('year', 'month') \
                .annotate(count=Count('id')) \
                .order_by('year', 'month')

            # Organize data per month
            games_over_time_dict = {}
            for entry in games_over_time:
                month_year = f"{entry['year']}-{entry['month']:02}"
                games_over_time_dict[month_year] = entry['count']

            games_played_over_time = [games_over_time_dict.get(month, 0) for month in last_12_months]

            # 5. Global Win/Loss Ratio
            total_wins = Game.objects.filter(winner__isnull=False).count()  # Assuming 'winner' is set when a game is won
            total_losses = Game.objects.filter(winner__isnull=True).count()  # Assuming 'winner' is null when a game is lost or tied
            # Alternatively, define loss based on game outcomes if available

            win_loss_ratio = {
                "wins": total_wins,
                "losses": total_losses
            }

            # 6. Average Game Duration per Mode
            avg_duration_per_mode = Game.objects.values('game_mode').annotate(average_duration=Avg('duration')).order_by('-average_duration')
            avg_duration_data = {entry['game_mode']: round(entry['average_duration'], 2) if entry['average_duration'] else 0 for entry in avg_duration_per_mode}

            # Prepare final JSON response
            data = {
                "games_played_per_mode": {
                    "labels": list(games_per_mode_data.keys()),
                    "data": list(games_per_mode_data.values())
                },
                "peak_playing_times": {
                    "labels": [entry["hour"] for entry in peak_playing_times],
                    "data": [entry["count"] for entry in peak_playing_times]
                },
                "game_modes_popularity": {
                    "labels": [entry["mode"] for entry in game_modes_popularity],
                    "data": [entry["percentage"] for entry in game_modes_popularity]
                },
                "games_played_over_time": {
                    "labels": last_12_months,
                    "data": games_played_over_time
                },
                "win_loss_ratio": win_loss_ratio,
                "average_game_duration_per_mode": {
                    "labels": list(avg_duration_data.keys()),
                    "data": list(avg_duration_data.values())
                }
            }

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error in GlobalStatsView GET: {e}")
            return Response(
                {"detail": "An unexpected error occurred."},
                status=status.HTTP_400_BAD_REQUEST
            )