# routing.py (at the project root level)
from accounts.routing import websocket_urlpatterns as accounts_websocket_urlpatterns
from games.routing import websocket_urlpatterns as games_websocket_urlpatterns

# Combine all websocket patterns
websocket_urlpatterns = accounts_websocket_urlpatterns + games_websocket_urlpatterns
