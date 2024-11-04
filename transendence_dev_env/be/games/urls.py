from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet, TournamentViewSet, TournamentStatisticsViewSet,GameLeaderboardSet, TournamentLeaderboardViewSet

router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')
router.register(r'tournaments', TournamentViewSet, basename='tournament')
router.register(r'tournament-statistics', TournamentStatisticsViewSet, basename='tournament-statistics')
router.register(r'game-leaderboard', GameLeaderboardSet, basename='game-leaderboard')
router.register(r'tournament-leaderboard', TournamentLeaderboardViewSet, basename='tournament-leaderboard')
urlpatterns = [
    path('', include(router.urls)),
]
