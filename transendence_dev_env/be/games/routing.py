from django.urls import path
from .consumers import LobbyConsumer, ChaosLobbyConsumer, ArenaLobbyConsumer, TournamentLobbyConsumer

websocket_urlpatterns = [
    path('ws/lobby/<str:room_id>/', LobbyConsumer.as_asgi()),
    path('ws/lobby_chaos/<str:room_id>/', ChaosLobbyConsumer.as_asgi()),
    path('ws/lobby_arena/<str:room_id>/', ArenaLobbyConsumer.as_asgi()),
    path('ws/tournament-lobby/<str:room_id>/', TournamentLobbyConsumer.as_asgi()),
]
