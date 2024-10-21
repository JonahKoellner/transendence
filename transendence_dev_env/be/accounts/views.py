from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from .serializers import RegisterSerializer, LoginSerializer, OTPVerifySerializer, TokenSerializer, UserProfileSerializer
from django.http import JsonResponse
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenRefreshView as SimpleJWTTokenRefreshView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.parsers import MultiPartParser, FormParser

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
    permission_classes = [IsAuthenticated]
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
                    secure=True,  # Set to True in production with HTTPS
                    samesite='Lax'  # Adjust based on your needs ('Strict', 'Lax', or 'None')
                )
            return response

        except InvalidToken:
            return Response({"message": "Invalid refresh token"}, status=status.HTTP_401_UNAUTHORIZED)
        except TokenError as e:
            return Response({"message": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"message": "An error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
