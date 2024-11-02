from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet, TournamentViewSet

router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')
router.register(r'tournaments', TournamentViewSet, basename='tournament')

urlpatterns = [
    path('', include(router.urls)),
]

urlpatterns = [
    path('', include(router.urls)),
]