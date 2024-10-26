"""
ASGI config for be project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "be.settings")
django.setup()  # Ensure Django apps are fully initialized

# Define the application after setup
def get_application():
    from accounts.middleware import JWTAuthMiddlewareStack  # Import after setup
    from accounts.routing import websocket_urlpatterns      # Import after setup

    return ProtocolTypeRouter({
        "http": get_asgi_application(),
        "websocket": JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        ),
    })

application = get_application()