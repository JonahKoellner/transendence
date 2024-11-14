from django.urls import path, include
from .views import RegisterView, LoginView, VerifyOTPView, TokenRefreshView, Enable2FAView, Disable2FAView, LogoutView, UserViewSet, NotificationViewSet, ChatMessageViewSet, AchievementListView
from rest_framework.routers import DefaultRouter
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'chat-messages', ChatMessageViewSet, basename='chatmessage')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify_otp'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('enable-2fa/', Enable2FAView.as_view(), name='enable-2fa'),
    path('disable-2fa/', Disable2FAView.as_view(), name='disable-2fa'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('achievements/', AchievementListView.as_view(), name='achievement-list'),
    path('', include(router.urls)),
]