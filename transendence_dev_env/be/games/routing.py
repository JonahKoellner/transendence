from django.urls import path
from .consumers import LobbyConsumer

websocket_urlpatterns = [
    path('ws/lobby/<str:room_id>/', LobbyConsumer.as_asgi()),
]
