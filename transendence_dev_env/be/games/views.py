from rest_framework import viewsets, permissions
from .models import Game
from .serializers import GameSerializer
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication

class GameViewSet(viewsets.ModelViewSet):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]


    def perform_create(self, serializer):
        player1 = self.request.user
        game_mode = serializer.validated_data.get('game_mode')
        player2 = serializer.validated_data.get('player2')

        serializer.save(player1=player1, game_mode=game_mode, player2=player2)

    def perform_update(self, serializer):
        instance = self.get_object()
        
        if serializer.validated_data.get('is_completed', False):
            # Calculate duration when game is marked as complete
            duration = (timezone.now() - instance.start_time).total_seconds()
            serializer.save(
                end_time=timezone.now(),
                duration=duration,
                winner=instance.player1 if instance.score_player1 > instance.score_player2 else instance.player2
            )
        else:
            serializer.save()