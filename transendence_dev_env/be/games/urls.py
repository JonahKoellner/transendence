from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet, TournamentViewSet, TournamentStatisticsViewSet,GameLeaderboardSet, TournamentLeaderboardViewSet, LobbyViewSet

router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')
router.register(r'tournaments', TournamentViewSet, basename='tournament')
router.register(r'tournament-statistics', TournamentStatisticsViewSet, basename='tournament-statistics')
router.register(r'game-leaderboard', GameLeaderboardSet, basename='game-leaderboard')
router.register(r'tournament-leaderboard', TournamentLeaderboardViewSet, basename='tournament-leaderboard')

lobby_create = LobbyViewSet.as_view({'post': 'create_room'})
lobby_join = LobbyViewSet.as_view({'post': 'join_room'})
lobby_ready = LobbyViewSet.as_view({'post': 'set_ready'})
lobby_status = LobbyViewSet.as_view({'get': 'room_status'})
lobby_list_rooms = LobbyViewSet.as_view({'get': 'list_rooms'})
lobby_delete = LobbyViewSet.as_view({'delete': 'delete_room'}) 

urlpatterns = [
    path('lobby/create/', lobby_create, name="lobby-create"),
    path('lobby/join/', lobby_join, name="lobby-join"),
    path('lobby/set_ready/', lobby_ready, name="lobby-set-ready"),
    path('lobby/status/<str:room_id>/', lobby_status, name="lobby-status"),
    path('lobby/rooms/', lobby_list_rooms, name="lobby-list-rooms"),
    path('lobby/delete/<str:room_id>/', lobby_delete, name="lobby-delete"),
    path('', include(router.urls)),
]
