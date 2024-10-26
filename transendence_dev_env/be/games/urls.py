from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet

router = DefaultRouter()
router.register(r'', GameViewSet)  # Register with an empty string for /games/ path only

urlpatterns = [
    path('', include(router.urls)),
]