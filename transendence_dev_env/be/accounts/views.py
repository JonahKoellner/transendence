from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from .serializers import RegisterSerializer, LoginSerializer, OTPVerifySerializer, TokenSerializer, UserProfileSerializer


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
            response_data = {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'is_2fa_enabled': user.profile.is_2fa_enabled
            }

            # Only send otp_uri if 2FA is not enabled
            if not user.profile.is_2fa_enabled:
                otp_uri = user.profile.generate_otp()  # Generates and saves the OTP secret
                response_data['otp_uri'] = otp_uri  # Send OTP URI for generating QR code

            return Response(response_data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]  # Ensure the user is authenticated
    authentication_classes = [JWTAuthentication]  # Ensure JWT Authentication is used

    def post(self, request):
        try:
            # Get the refresh token from the request data
            refresh_token = request.data.get("refresh_token")
            token = RefreshToken(refresh_token)
            token.blacklist()  # Blacklist the refresh token (if blacklisting is enabled)
            return Response({"message": "Logout successful"}, status=status.HTTP_205_RESET_CONTENT)
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

            # Ensure the user has an OTP secret before verifying the OTP
            if not request.user.profile.otp_secret:
                return Response({"success": False, "message": "2FA is not enabled for this user"}, status=status.HTTP_400_BAD_REQUEST)

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
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user
        profile = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_2fa_enabled': user.profile.is_2fa_enabled  # Send 2FA status
        }
        return Response(profile, status=status.HTTP_200_OK)
    
class TokenRefreshView(APIView):
    def post(self, request):
        serializer = TokenSerializer(data=request.data)
        if serializer.is_valid():
            try:
                refresh_token = serializer.validated_data['refresh']
                refresh = RefreshToken(refresh_token)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token)
                })
            except Exception:
                return Response({"message": "Invalid refresh token"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
