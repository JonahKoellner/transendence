from rest_framework import viewsets, permissions, status
from .models import Game
from .serializers import GameSerializer
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import models

class GameViewSet(viewsets.ModelViewSet):
    """
    A viewset for performing CRUD operations on games.
    Shows only games where the authenticated user is a participant.
    Includes custom actions for retrieving games by user and specific game details.
    """
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        """
        Override the default queryset to show only games where the authenticated user
        is either player1 or player2.
        """
        user = self.request.user
        return Game.objects.filter(models.Q(player1=user) | models.Q(player2=user))

    def perform_create(self, serializer):
        """
        Override the creation process to set the authenticated user as player1.
        """
        serializer.save(player1=self.request.user)

    def perform_update(self, serializer):
        """
        Override the update process. If the game is marked as completed,
        automatically set the end time, calculate the duration, and determine the winner.
        """
        instance = self.get_object()
        
        if serializer.validated_data.get('is_completed', False):
            # Calculate duration when game is marked as complete
            duration = (timezone.now() - instance.start_time).total_seconds()
            winner = instance.player1 if instance.score_player1 > instance.score_player2 else instance.player2
            serializer.save(
                end_time=timezone.now(),
                duration=duration,
                winner=winner
            )
        else:
            serializer.save()

    @action(detail=False, methods=['get'], url_path='by-user/(?P<user_id>\d+)')
    def get_games_by_user(self, request, user_id=None):
        """
        Custom endpoint to retrieve all games where a specific user (user_id) is either player1 or player2.
        """
        games = Game.objects.filter(models.Q(player1_id=user_id) | models.Q(player2_id=user_id))
        serializer = self.get_serializer(games, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='game-detail')
    def get_game_by_id(self, request, pk=None):
        """
        Custom endpoint to retrieve a single game by its ID, accessible only to participants.
        """
        game = get_object_or_404(Game, models.Q(player1=request.user) | models.Q(player2=request.user), pk=pk)
        serializer = self.get_serializer(game)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Override destroy to allow deletion only if the user is a participant in the game.
        """
        instance = self.get_object()
        if instance.player1 != request.user and instance.player2 != request.user:
            return Response(
                {"detail": "You do not have permission to delete this game."},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)
