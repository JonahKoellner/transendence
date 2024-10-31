# accounts/middleware.py

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser, User
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from urllib.parse import parse_qs
import jwt
from django.conf import settings
from channels.middleware import BaseMiddleware

@database_sync_to_async
def get_user(token):
    try:
        validated_token = UntypedToken(token)
        user = JWTAuthentication().get_user(validated_token)
        print(f"Authenticated user: {user.username}")  # Debugging log
        return user
    except jwt.ExpiredSignatureError:
        print("Token expired")  # Debugging log
        return AnonymousUser()
    except jwt.InvalidTokenError:
        print("Invalid token")  # Debugging log
        return AnonymousUser()
    except Exception as e:
        print(f"Authentication error: {e}")  # Debugging log
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope['query_string'].decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token')
        if token:
            token = token[0]
            user = await get_user(token)
            scope['user'] = user
        else:
            scope['user'] = AnonymousUser()
        return await super().__call__(scope, receive, send)

def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
