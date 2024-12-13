from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet, TournamentViewSet, LobbyViewSet, ChaosLobbyViewSet, ArenaLobbyViewSet, StatsViewSet, GameStatsViewSet

router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')
router.register(r'tournaments', TournamentViewSet, basename='tournament')
router.register(r'stats', StatsViewSet, basename='stats') 
lobby_create = LobbyViewSet.as_view({'post': 'create_room'})
lobby_join = LobbyViewSet.as_view({'post': 'join_room'})
lobby_ready = LobbyViewSet.as_view({'post': 'set_ready'})
lobby_status = LobbyViewSet.as_view({'get': 'room_status'})
lobby_list_rooms = LobbyViewSet.as_view({'get': 'list_rooms'})
lobby_delete = LobbyViewSet.as_view({'delete': 'delete_room'}) 

lobby_create_chaos = ChaosLobbyViewSet.as_view({'post': 'create_room'})
lobby_join_chaos = ChaosLobbyViewSet.as_view({'post': 'join_room'})
lobby_ready_chaos = ChaosLobbyViewSet.as_view({'post': 'set_ready'})
lobby_status_chaos = ChaosLobbyViewSet.as_view({'get': 'room_status'})
lobby_list_rooms_chaos = ChaosLobbyViewSet.as_view({'get': 'list_rooms'})
lobby_delete_chaos = ChaosLobbyViewSet.as_view({'delete': 'delete_room'})

lobby_create_arena = ArenaLobbyViewSet.as_view({'post': 'create_room'})
lobby_join_arena = ArenaLobbyViewSet.as_view({'post': 'join_room'})
lobby_ready_arena = ArenaLobbyViewSet.as_view({'post': 'set_ready'})
lobby_status_arena = ArenaLobbyViewSet.as_view({'get': 'room_status'})
lobby_list_rooms_arena = ArenaLobbyViewSet.as_view({'get': 'list_rooms'})
lobby_delete_arena = ArenaLobbyViewSet.as_view({'delete': 'delete_room'})

game_stats = GameStatsViewSet.as_view({'get': 'retrieve'})

urlpatterns = [
    path('lobby/create/', lobby_create, name="lobby-create"),
    path('lobby/join/', lobby_join, name="lobby-join"),
    path('lobby/set_ready/', lobby_ready, name="lobby-set-ready"),
    path('lobby/status/<str:room_id>/', lobby_status, name="lobby-status"),
    path('lobby/rooms/', lobby_list_rooms, name="lobby-list-rooms"),
    path('lobby/delete/<str:room_id>/', lobby_delete, name="lobby-delete"),

    path('lobby_chaos/create/', lobby_create_chaos, name="lobby-create"),
    path('lobby_chaos/join/', lobby_join_chaos, name="lobby-join"),
    path('lobby_chaos/set_ready/', lobby_ready_chaos, name="lobby-set-ready"),
    path('lobby_chaos/status/<str:room_id>/', lobby_status_chaos, name="lobby-status"),
    path('lobby_chaos/rooms/', lobby_list_rooms_chaos, name="lobby-list-rooms"),
    path('lobby_chaos/delete/<str:room_id>/', lobby_delete_chaos, name="lobby-delete"),

    path('lobby_arena/create/', lobby_create_arena, name="lobby-create"),
    path('lobby_arena/join/', lobby_join_arena, name="lobby-join"),
    path('lobby_arena/set_ready/', lobby_ready_arena, name="lobby-set-ready"),
    path('lobby_arena/status/<str:room_id>/', lobby_status_arena, name="lobby-status"),
    path('lobby_arena/rooms/', lobby_list_rooms_arena, name="lobby-list-rooms"),
    path('lobby_arena/delete/<str:room_id>/', lobby_delete_arena, name="lobby-delete"),

    path('stats/detailed-stats/<int:pk>/', game_stats, name='game-stats'),
    path('', include(router.urls)),
]
