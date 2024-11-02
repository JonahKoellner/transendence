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
from datetime import timedelta
from django.db.models import Avg, Max, Min, Count, Q
import calendar
from django.contrib.auth.models import User 

from .models import Tournament
from .serializers import TournamentSerializer

class GameViewSet(viewsets.ModelViewSet):
    """
    A viewset for performing CRUD operations on games.
    Shows only games where the authenticated user is a participant.
    Includes custom actions for retrieving games by user and specific game details.
    """
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def calculate_xp_gain(self, game, player, is_winner=False):
        """
        Calculate the XP gain for a player based on game factors.
        """
        # Set a default duration to handle None values
        game_duration = game.duration if game.duration is not None else 0

        # Base XP values
        base_xp = 50  # Base XP for winning a game
        level_bonus = 1.5 * player.profile.level  # Incremental bonus per player level

        # Calculate duration-based XP, with diminishing returns
        if game_duration < 300:  # Short game
            duration_xp = game_duration * 0.5  # 0.5 XP per second for shorter games
        elif game_duration < 1200:  # Medium game
            duration_xp = game_duration * 0.3  # 0.3 XP per second for medium length games
        else:  # Long game
            duration_xp = min(400 + (game_duration - 1200) * 0.1, 600)  # Cap XP for long games

        # Score difference multiplier for higher XP based on performance
        score_difference = abs(game.score_player1 - game.score_player2)
        performance_multiplier = 1 + min(score_difference / 100, 0.5)  # Up to +50% XP based on score gap

        # Game mode multiplier: more challenging modes award more XP
        if game.game_mode == Game.PVE:
            mode_multiplier = 0.7 if not is_winner else 1.0  # PvE easier, give less XP if lost
        elif game.game_mode == Game.LOCAL_PVP:
            mode_multiplier = 1.0 if not is_winner else 1.1  # Balanced mode, slight bonus for win
        else:
            mode_multiplier = 1.1 if not is_winner else 1.3  # Online PvP, higher reward for higher challenge

        # Apply base, duration, level, performance, and mode multipliers
        xp_gain = (base_xp + duration_xp + level_bonus) * performance_multiplier * mode_multiplier

        # Additional XP for winning, varies by game mode
        if is_winner:
            xp_gain += 50 if game.game_mode == Game.PVE else 75  # Higher bonus for PvP games

        return int(xp_gain)

    def get_queryset(self):
        """
        Override the default queryset to show only games where the authenticated user
        is either player1 or player2.
        """
        user = self.request.user
        return Game.objects.filter(models.Q(player1=user) | models.Q(player2=user))
    
    def perform_create(self, serializer):
        data = serializer.validated_data
        game_mode = data.get('game_mode')

        if game_mode == Game.LOCAL_PVP and data.get('player2', {}).get('id') == 0:
            # Local PvP with placeholder name
            player2_name_pvp_local = data.get('player2', {}).get('username')
            serializer.save(player1=self.request.user, player2_name_pvp_local=player2_name_pvp_local)
        else:
            # Regular PvP or PvE game
            serializer.save(player1=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        validated_data = serializer.validated_data
        winner, loser = None, None
        winner_xp, loser_xp = 0, 0
        
        if validated_data.get('game_mode') == Game.LOCAL_PVP and validated_data.get('player2', {}).get('id') == 0:
            # Update player2_name if provided in local PvP game mode
            instance.player2_name_pvp_local = validated_data.get('player2', {}).get('username')


        if validated_data.get('is_completed', False):
            # Calculate and set duration if not already set
            instance.duration = instance.duration or (timezone.now() - instance.start_time).total_seconds()

            # Determine winner and loser
            score_player1 = validated_data.get('score_player1', instance.score_player1)
            score_player2 = validated_data.get('score_player2', instance.score_player2)

            if instance.is_against_ai():  # PvE mode
                if score_player1 > score_player2:
                    winner = instance.player1
                else:
                    loser = instance.player1  # Player loses to AI
            else:  # PvP mode, including local PvP with a name placeholder for player2
                if isinstance(instance.player2, User):  # player2 is an authenticated User
                    if score_player1 > score_player2:
                        winner, loser = instance.player1, instance.player2
                    elif score_player2 > score_player1:
                        winner, loser = instance.player2, instance.player1
                elif instance.game_mode == Game.LOCAL_PVP and isinstance(instance.player2, str):
                    # Local PvP with a placeholder name for player2
                    if score_player1 > score_player2:
                        winner = instance.player1
                    else:
                        loser = instance.player1  # Player1 loses to a named player2

            # Calculate XP gain for the winner and loser
            if winner:
                winner_xp = self.calculate_xp_gain(instance, winner, is_winner=True)

            if loser:
                # Loser gets a fraction of XP; ensure they get at least a minimum amount
                loser_xp = max(10, self.calculate_xp_gain(instance, loser, is_winner=False) // 4)

            # Save game with end time, duration, and winner
            serializer.save(end_time=timezone.now(), duration=instance.duration, winner=winner)

            # Apply XP to profiles if winner and loser are actual User instances
            if isinstance(winner, User):
                winner.profile.add_xp(winner_xp)
            if isinstance(loser, User):
                loser.profile.add_xp(loser_xp)

        else:
            serializer.save()
            
    @action(detail=False, methods=['get'], url_path='user-stats')
    def user_statistics(self, request):
        user = request.user
        games = Game.objects.filter(Q(player1=user) | Q(player2=user))
        total_games = games.count()

        # PvE and PvP breakdown
        pve_games = games.filter(game_mode=Game.PVE)
        pvp_games = games.exclude(game_mode=Game.PVE)
        total_pve_games = pve_games.count()
        total_pvp_games = pvp_games.count()
        
        # Basic stats
        wins = games.filter(winner=user).count()
        win_rate = (wins / total_games) * 100 if total_games > 0 else 0
        losses = total_games - wins
        average_duration = games.aggregate(avg_duration=Avg('duration'))['avg_duration']
        scores = [game.score_player1 if game.player1 == user else game.score_player2 for game in games]
        avg_score_per_game = sum(scores) / total_games if total_games > 0 else 0

        # Win streaks (current and max)
        current_streak = 0
        max_streak = 0
        for game in games.order_by('-start_time'):
            if game.winner == user:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0

        # Monthly performance for the last year
        start_date = timezone.now() - timedelta(days=365)
        monthly_performance = {}
        for month in range(1, 13):
            month_games = games.filter(start_time__month=month, start_time__gte=start_date)
            month_wins = month_games.filter(winner=user).count()
            monthly_performance[calendar.month_name[month]] = {
                'games': month_games.count(),
                'win_rate': (month_wins / month_games.count() * 100) if month_games else 0
            }

        # First-move win rate
        first_move_games = games.filter(moves_log__0__player=user.username)  # Games where user made the first move
        first_move_wins = first_move_games.filter(winner=user).count()
        first_move_win_rate = (first_move_wins / first_move_games.count() * 100) if first_move_games else 0

        # Average moves per game
        total_moves = sum(len(game.moves_log or []) for game in games)
        avg_moves_per_game = total_moves / total_games if total_games > 0 else 0

        # Round-wise analysis
        total_rounds = sum(len(game.rounds or []) for game in games)
        avg_score_per_round = sum(scores) / total_rounds if total_rounds > 0 else 0
        max_score_round = max((round['score_player1'] if user == game.player1 else round['score_player2']
                            for game in games for round in game.rounds or []), default=0)

        # Performance by time of day
        performance_by_time = {}
        for hour in range(24):
            hour_games = games.filter(start_time__hour=hour)
            hour_wins = hour_games.filter(winner=user).count()
            performance_by_time[hour] = {
                'games': hour_games.count(),
                'win_rate': (hour_wins / hour_games.count() * 100) if hour_games else 0
            }

        # Construct data dictionary with all statistics
        data = {
            'total_games': total_games,
            'pve_games': total_pve_games,
            'pvp_games': total_pvp_games,
            'wins': wins,
            'losses': losses,
            'win_rate': win_rate,
            'average_duration': average_duration,
            'avg_score_per_game': avg_score_per_game,
            'max_win_streak': max_streak,
            'current_win_streak': current_streak,
            'monthly_performance': monthly_performance,
            'first_move_win_rate': first_move_win_rate,
            'avg_moves_per_game': avg_moves_per_game,
            'avg_score_per_round': avg_score_per_round,
            'max_score_round': max_score_round,
            'performance_by_time': performance_by_time,
        }

        return Response(data, status=status.HTTP_200_OK)

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
        Custom endpoint to retrieve a single game by its ID, accessible to participants or friends of participants.
        """
        game = get_object_or_404(Game, pk=pk)

        # Retrieve authenticated user and their friends
        user = request.user
        friends_profiles = user.profile.get_friends()  # This returns Profile instances
        friends_users = [profile.user for profile in friends_profiles]  # Convert to User instances

        # Collect debugging information
        debug_info = {
            "user": user.username,
            "friends": [friend.username for friend in friends_users],
            "game_participants": {
                "player1": game.player1.username,
                "player2": game.player2.username if game.player2 else "AI"
            }
        }
        # Check if the user is a participant or a friend of a participant
        if game.player1 == user or game.player2 == user or \
        game.player1 in friends_users or (game.player2 in friends_users if game.player2 else False):
            serializer = self.get_serializer(game)
            
            # Include debug information in the response
            response_data = serializer.data
            response_data['debug_info'] = debug_info
            return Response(response_data, status=status.HTTP_200_OK)
        else:
            # Return debug information if permission is denied
            debug_info['error'] = "You do not have permission to view this game."
            return Response(debug_info, status=status.HTTP_403_FORBIDDEN)

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


class TournamentViewSet(viewsets.ModelViewSet):
    """
    A viewset that provides the standard actions for Tournament model,
    including additional filtering by participants.
    """
    queryset = Tournament.objects.all()
    serializer_class = TournamentSerializer

    def create(self, request, *args, **kwargs):
        """
        Create a new tournament and return its ID in the response.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tournament = serializer.save()
        
        # Serialize the tournament instance to include the ID in the response
        response_serializer = self.get_serializer(tournament)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        """
        Retrieve a tournament by ID.
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """
        Update a tournament by ID.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """
        Delete a tournament by ID.
        """
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='by-participant')
    def get_by_participant(self, request):
        """
        Custom action to retrieve tournaments by participant.
        Query parameter: participant=<participant_name>
        """
        participant = request.query_params.get('participant')
        if participant:
            tournaments = Tournament.objects.filter(all_participants__contains=[participant])
            serializer = self.get_serializer(tournaments, many=True)
            return Response(serializer.data)
        return Response({"error": "Participant parameter is required"}, status=status.HTTP_400_BAD_REQUEST)