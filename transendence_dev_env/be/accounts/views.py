from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.response import Response
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication

from .serializers import (
    RegisterSerializer, LoginSerializer, OTPVerifySerializer,
    TokenSerializer, UserProfileSerializer, NotificationSerializer,
    UserProfileSerializer, UserDetailSerializer, ChatMessageSerializer
)
from .utils import create_notification
from django.http import JsonResponse
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from .models import Notification, ChatMessage
from django.db import models

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data
            refresh = RefreshToken.for_user(user)
            data = {
                'access': str(refresh.access_token),
                'is_2fa_enabled': user.profile.is_2fa_enabled
            }

            otp_uri = user.profile.generate_otp()  # Generates and saves the OTP secret
            data['otp_uri'] = otp_uri  # Include otp_uri in the response data

            response = JsonResponse(data)

            # Set the refresh token as an HTTP-only secure cookie
            cookie_max_age = api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()
            response.set_cookie(
                'refresh_token',
                str(refresh),
                max_age=cookie_max_age,
                httponly=True,
                secure=True,  # Ensure this is True in production with HTTPS
                samesite='Lax'
            )
            return response
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        try:
            # Get the refresh token from the cookies
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token is None:
                return Response({"message": "Refresh token not found"}, status=status.HTTP_400_BAD_REQUEST)
            token = RefreshToken(refresh_token)
            token.blacklist()
            response = Response({"message": "Logout successful"}, status=status.HTTP_205_RESET_CONTENT)
            # Delete the refresh token cookie
            response.delete_cookie('refresh_token')
            return response
        except Exception as e:
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
                # Automatically enable 2FA after successful OTP verification
                if not request.user.profile.is_2fa_enabled:
                    request.user.profile.is_2fa_enabled = True  # Enable 2FA
                    request.user.profile.save()

                return Response({"success": True, "message": "OTP verified successfully, 2FA is now enabled"}, status=status.HTTP_200_OK)
            
            return Response({"success": False, "message": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# View user profile (JWT required)
class UserProfileView(APIView):
    """
    API View for retrieving and updating the authenticated user's profile.
    """
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        user = request.user
        serializer = UserProfileSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        user = request.user
        serializer = UserProfileSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Profile updated successfully", "user": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class TokenRefreshView(SimpleJWTTokenRefreshView):
    def post(self, request, *args, **kwargs):
        try:
            # Retrieve the refresh token from the cookies
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token is None:
                return Response({"message": "Refresh token not found"}, status=status.HTTP_401_UNAUTHORIZED)
            
            # Validate the refresh token
            serializer = self.get_serializer(data={'refresh': refresh_token})
            serializer.is_valid(raise_exception=True)
            
            # Generate new tokens
            access_token = serializer.validated_data['access']
            refresh = serializer.validated_data.get('refresh')
            
            response_data = {'access': access_token}
            response = Response(response_data)

            # If rotating refresh tokens, set the new refresh token in the cookie
            if api_settings.ROTATE_REFRESH_TOKENS and refresh:
                cookie_max_age = api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()
                response.set_cookie(
                    'refresh_token',
                    str(refresh),
                    max_age=cookie_max_age,
                    httponly=True,
                    secure=not settings.DEBUG,  # True in production, False in development
                    samesite='Lax'
                )
            return response

        except InvalidToken:
            return Response({"message": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)
        except TokenError as e:
            return Response({"message": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"message": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_serializer_class(self):
        if self.action in ['retrieve']:
            return UserDetailSerializer
        return UserProfileSerializer

    def list(self, request, *args, **kwargs):
        """
        Override the list method to return only the authenticated user's data.
        """
        user = request.user
        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        user = request.user
        serializer = UserProfileSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Profile updated successfully", "user": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='search')
    def search_users(self, request):
        query = request.query_params.get('q', '')
        users = User.objects.filter(username__icontains=query).exclude(id=request.user.id)
        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='add-friend')
    def add_friend(self, request, pk=None):
        """
        Add a user as a friend.
        """
        user_to_add = get_object_or_404(User, pk=pk)

        # Prevent adding oneself as a friend
        if user_to_add == request.user:
            return Response({'detail': 'You cannot add yourself as a friend.'}, status=status.HTTP_400_BAD_REQUEST)

        # Access profiles
        sender_profile = request.user.profile
        receiver_profile = user_to_add.profile

        # Check if already friends
        if receiver_profile in sender_profile.friends.all():
            return Response({'detail': 'Already friends.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Add the receiver's profile to sender's friends
        sender_profile.friends.add(receiver_profile)
        
        # Create a notification for the user being added
        create_notification(
            sender=request.user,
            receiver=user_to_add,
            notification_type='friend_request',
            data={'message': f'{request.user.username} added you as a friend.'},
            priority='medium'
        )
        return Response({'status': 'Friend added.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='remove-friend')
    def remove_friend(self, request, pk=None):
        """
        Remove a user from friends.
        """
        user_to_remove = get_object_or_404(User, pk=pk)

        sender_profile = request.user.profile
        receiver_profile = user_to_remove.profile

        # Check if they are friends
        if receiver_profile not in sender_profile.friends.all():
            return Response({'detail': 'Not friends.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Remove the receiver's profile from sender's friends
        sender_profile.friends.remove(receiver_profile)
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
        
        # Block the receiver's profile
        sender_profile.blocked_users.add(receiver_profile)
        return Response({'status': 'User blocked.'}, status=status.HTTP_200_OK)

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

        # Prevent sending messages to blocked users
        if receiver in request.user.profile.blocked_users.all():
            return Response({'detail': 'Cannot send message to this user.'}, status=status.HTTP_400_BAD_REQUEST)

        message = ChatMessage.objects.create(
            sender=request.user,
            receiver=receiver,
            message=message_text
        )

        # Optionally, create a notification for the receiver about the new message
        create_notification(sender=request.user, receiver=receiver, notification_type='new_message', data={'message': message_text})

        return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)

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
