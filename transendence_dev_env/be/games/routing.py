from django.urls import path
from .consumers import LobbyConsumer, ChaosLobbyConsumer

websocket_urlpatterns = [
    path('ws/lobby/<str:room_id>/', LobbyConsumer.as_asgi()),
    path('ws/lobby_chaos/<str:room_id>/', ChaosLobbyConsumer.as_asgi()),
]
