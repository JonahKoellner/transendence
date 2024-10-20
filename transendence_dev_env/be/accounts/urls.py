from django.urls import path
from .views import RegisterView, LoginView, VerifyOTPView, UserProfileView, TokenRefreshView, Enable2FAView, Disable2FAView, LogoutView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('enable-2fa/', Enable2FAView.as_view(), name='enable-2fa'),
    path('disable-2fa/', Disable2FAView.as_view(), name='disable-2fa'),
    path('logout/', LogoutView.as_view(), name='logout'),
]