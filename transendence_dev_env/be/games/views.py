from rest_framework import viewsets, permissions, status
from .serializers import GameSerializer
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import models
from datetime import timedelta
from django.db.models import Avg, Max, Min, Count, Sum, Q, F, Case, When, IntegerField, FloatField, OuterRef, Subquery
import calendar
from django.contrib.auth.models import User 
from accounts.serializers import UserProfileSerializer
from .models import Tournament, Match, Round, Game, Lobby, Stage, TournamentType, MatchOutcome
from django.db.models.functions import Abs
from django.db.models.functions import Cast
from .serializers import TournamentSerializer
import random
import string
from django.db import transaction 

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
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
    
    def calculate_tournament_xp(self, tournament, player):
        """
        Calculate advanced XP for a player based on their performance, progression, tournament type,
        and the type of opponents they faced (bot or player).
        """
        # Base XP values
        base_xp_participation = 10  # Basic XP for entering
        base_xp_win = 50            # Base XP for each match won
        round_bonus_xp = 100         # XP bonus for advancing each round in Single Elimination
        final_bonus_xp = 1000        # Large bonus for winning the tournament

        # Type-specific and progression multipliers
        type_multiplier = 1.0
        progression_multiplier = 1.0
        performance_multiplier = 1.0
        consistency_bonus = 0.0
        opponent_factor = 1.0
        rounds_played = 0
        # Calculate progression-based multipliers and bonuses
        if tournament.type == TournamentType.SINGLE_ELIMINATION:
            rounds_played = tournament.rounds.filter(matches__player1=player.username).count() \
                        + tournament.rounds.filter(matches__player2=player.username).count()
            total_rounds = tournament.rounds.count()
            progression_multiplier = 1 + (rounds_played / total_rounds) * 0.7  # Bonus up to +70%

            for round in tournament.rounds.all():
                if round.matches.filter(winner=player.username).exists():
                    stage = round.stage
                    if stage == Stage.QUARTER_FINALS:
                        progression_multiplier += 0.1
                    elif stage == Stage.SEMI_FINALS:
                        progression_multiplier += 0.2
                    elif stage == Stage.GRAND_FINALS:
                        progression_multiplier += 0.5

            type_multiplier = 1.3

        elif tournament.type == TournamentType.ROUND_ROBIN:
            total_matches = tournament.rounds.filter(matches__player1=player.username).count() \
                            + tournament.rounds.filter(matches__player2=player.username).count()
            total_wins = tournament.rounds.filter(matches__winner=player.username).count()
            
            win_ratio = total_wins / max(1, total_matches)
            if win_ratio > 0.8:
                consistency_bonus = 200
            elif win_ratio > 0.5:
                consistency_bonus = 100

            group_rank = self.get_round_robin_rank(tournament, player)
            if group_rank == 1:
                performance_multiplier = 1.5
            elif group_rank == 2:
                performance_multiplier = 1.2
            elif group_rank == 3:
                performance_multiplier = 1.1

            type_multiplier = 1.1

        # Opponent type factor: more XP for winning against players than bots
        total_wins = 0
        bot_wins = 0
        for match in tournament.rounds.filter(matches__winner=player.username):
            total_wins += 1
            if match.player1_type == 'Bot' or match.player2_type == 'Bot':
                bot_wins += 1

        bot_win_ratio = bot_wins / max(1, total_wins)
        opponent_factor = 0.8 + (1 - bot_win_ratio) * 0.2  # Higher XP if fewer wins are against bots

        # Tournament size multiplier
        participant_count = len(tournament.all_participants)
        size_multiplier = 1 + (participant_count / 100)

        # Duration-based XP, with diminishing returns for longer tournaments
        if tournament.duration:
            if tournament.duration < 3600:
                duration_xp = tournament.duration * 0.1
            elif tournament.duration < 14400:
                duration_xp = tournament.duration * 0.05
            else:
                duration_xp = min(600, 400 + (tournament.duration - 14400) * 0.01)
        else:
            duration_xp = 0

        # Final XP calculation
        xp_gain = (
            base_xp_participation +                    # Base XP for joining
            base_xp_win * total_wins +                 # XP for each win
            round_bonus_xp * rounds_played +           # Bonus for advancing rounds
            consistency_bonus +                        # Consistency bonus
            (final_bonus_xp if tournament.final_winner == player.username else 0) +  # Bonus for winning tournament
            duration_xp                                # Duration-based XP
        )

        # Apply all calculated multipliers
        xp_gain *= type_multiplier
        xp_gain *= progression_multiplier
        xp_gain *= performance_multiplier
        xp_gain *= size_multiplier
        xp_gain *= opponent_factor  # Apply the opponent factor at the end

        return int(xp_gain)

    def get_round_robin_rank(self, tournament, player):
        """
        Determines the player's ranking within a Round Robin tournament group.
        """
        # Assuming each participant is represented by their username
        participants = tournament.all_participants  # List of usernames
        scores = {username: 0 for username in participants}

        # Fetch all finished matches in the tournament
        matches = Match.objects.filter(rounds__tournaments=tournament, outcome=MatchOutcome.FINISHED)

        # Update scores based on match results
        for match in matches:
            if match.winner in scores:
                scores[match.winner] += 1

        # Sort players by score in descending order
        sorted_players = sorted(scores.items(), key=lambda item: item[1], reverse=True)

        # Find the rank of the current player
        for rank, (username, _) in enumerate(sorted_players, start=1):
            if username == player.username:
                return rank

        # If player not found, return the length of sorted_players
        return len(sorted_players)

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

        if serializer.validated_data.get("status") == "completed":
            # Update tournament end time and calculate duration
            instance.end_time = timezone.now()
            instance.duration = (instance.end_time - instance.start_time).total_seconds() if instance.start_time else None
            instance.save()

            # Calculate and add XP to the host
            host = instance.host
            xp_gain = self.calculate_tournament_xp(instance, host)
            host.profile.add_xp(xp_gain)  # Assumes profile has an `add_xp` method to handle XP addition
            host.profile.save()

        return Response(serializer.data, status=status.HTTP_200_OK)

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
    
    @action(detail=False, methods=['get'], url_path='by-user/(?P<user_id>\d+)')
    def get_tournaments_by_user(self, request, user_id=None):
        """
        Custom action to retrieve all tournaments where the specified user (user_id) is a participant or the host.
        """
        # Get the user object based on the provided user_id
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Filter tournaments where the user is the host
        hosted_tournaments = Tournament.objects.filter(host=user)

        # Filter tournaments where the user is in the participants list (checking for username or display_name)
        participant_tournaments = Tournament.objects.filter(
            models.Q(all_participants__contains=[user.username]) |
            models.Q(all_participants__contains=[user.profile.display_name])
        )

        # Combine hosted and participant tournaments
        tournaments = hosted_tournaments | participant_tournaments
        tournaments = tournaments.distinct()  # Remove duplicates if any

        # Serialize and return the results
        serializer = self.get_serializer(tournaments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

    """
    ViewSet for generating highly detailed statistics for tournaments.
    Includes endpoints for various granular tournament statistics.
    """
    
    def list(self, request):
        """
        If no specific endpoint is specified, return a summary of all available statistics endpoints.
        """
        stats_endpoints = {
            "overview": "Comprehensive overview of tournament statistics with extended details.",
            "player-performance": "Detailed player performance across all tournaments.",
            "historical-performance": "Historical tournament performance trends over the last two years.",
            "round-difficulty-analysis": "Analysis of tournament round difficulty.",
            "advanced-scoring-analytics": "Detailed scoring analytics for tournaments.",
            "tournament-participation-metrics": "Metrics on tournament participation.",
            "advanced-stage-analytics": "Advanced analytics by tournament stage.",
            "tournament-type-performance": "Performance metrics by tournament type.",
            "time-based-performance": "Tournament performance by time of day.",
            "round-based-analysis": "Detailed analysis of tournament rounds.",
            "stage-performance": "Performance data for each tournament stage.",
            "tournament-type-breakdown": "Breakdown of tournaments by type.",
            "match-outcomes": "Statistics on match outcomes.",
        }
        return Response(stats_endpoints, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='overview')
    def tournament_overview(self, request):
        """
        Comprehensive overview of tournament statistics with extended details.
        """
        total_tournaments = Tournament.objects.count()
        ongoing_tournaments = Tournament.objects.filter(status='ongoing').count()
        completed_tournaments = Tournament.objects.filter(status='completed').count()
        avg_duration = Tournament.objects.aggregate(avg_duration=Avg('duration'))['avg_duration']
        max_duration = Tournament.objects.aggregate(max_duration=Max('duration'))['max_duration']
        min_duration = Tournament.objects.aggregate(min_duration=Min('duration'))['min_duration']
        avg_participants = Tournament.objects.aggregate(avg_participants=Avg('all_participants__length'))['avg_participants']
        avg_rounds_per_tournament = Round.objects.values('tournaments').annotate(count=Count('id')).aggregate(avg_rounds=Avg('count'))

        data = {
            'total_tournaments': total_tournaments,
            'ongoing_tournaments': ongoing_tournaments,
            'completed_tournaments': completed_tournaments,
            'average_duration': avg_duration,
            'max_duration': max_duration,
            'min_duration': min_duration,
            'average_participants_per_tournament': avg_participants,
            'average_rounds_per_tournament': avg_rounds_per_tournament,
        }
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='player-performance')
    def player_performance(self, request):
        """
        Detailed player performance across all tournaments.
        Returns win/loss count, average placement, longest win streak, and average points per match.
        """
        player_stats = []
        players = User.objects.all()
        all_tournaments = Tournament.objects.all()  # Fetch all tournaments once to minimize DB hits

        for player in players:
            # Count tournaments where the player is the final winner
            win_count = sum(1 for tournament in all_tournaments if tournament.final_winner == player.username)

            # Count total participations where the player appears in all_participants or players_only
            total_participations = sum(
                1 for tournament in all_tournaments
                if player.username in tournament.all_participants or player.username in tournament.players_only
            )

            # Calculate losses and win rate
            loss_count = total_participations - win_count
            win_rate = (win_count / total_participations) * 100 if total_participations > 0 else 0

            # Calculate average placement
            placements = [
                (tournament.all_participants.index(player.username) + 1)
                for tournament in all_tournaments
                if player.username in tournament.all_participants
            ]
            avg_placement = sum(placements) / len(placements) if placements else None

            # Calculate the longest win streak using a helper function
            longest_win_streak = self.calculate_longest_streak(player, all_tournaments)

            # Calculate the average points per match
            avg_points_per_match = Match.objects.filter(
                Q(player1=player) | Q(player2=player)
            ).aggregate(
                avg_points=(Avg('player1_score') + Avg('player2_score')) / 2
            )['avg_points']

            # Append stats for the player
            player_stats.append({
                'username': player.username,
                'win_count': win_count,
                'loss_count': loss_count,
                'total_participations': total_participations,
                'win_rate': win_rate,
                'average_placement': avg_placement,
                'longest_win_streak': longest_win_streak,
                'average_points_per_match': avg_points_per_match,
            })

        return Response(player_stats, status=status.HTTP_200_OK)

    def calculate_longest_streak(self, player, tournaments):
        """
        Helper function to calculate the longest win streak for a player in tournaments.
        """
        longest_streak = 0
        current_streak = 0

        # Order tournaments by start time to maintain streak order
        ordered_tournaments = sorted(tournaments, key=lambda x: x.start_time)

        for tournament in ordered_tournaments:
            if player.username == tournament.final_winner:
                # Increment streak if the player won this tournament
                current_streak += 1
                longest_streak = max(longest_streak, current_streak)
            else:
                # Reset streak if the player didn't win
                current_streak = 0

        return longest_streak

    @action(detail=False, methods=['get'], url_path='historical-performance')
    def historical_performance(self, request):
        """
        Historical tournament performance trends over the last two years.
        Includes win rates, average scores, and tournament frequency by month.
        """
        current_date = timezone.now()
        two_years_ago = current_date - timedelta(days=730)
        monthly_data = {}

        for month in range(1, 13):
            month_start = two_years_ago.replace(month=month)
            month_end = month_start + timedelta(days=30)

            monthly_tournaments = Tournament.objects.filter(
                start_time__gte=month_start,
                start_time__lt=month_end
            )
            completed_tournaments = monthly_tournaments.filter(status='completed').count()
            win_rate = monthly_tournaments.filter(
                Q(status='completed') & Q(final_winner__isnull=False)
            ).count() / completed_tournaments * 100 if completed_tournaments else 0
            avg_score = monthly_tournaments.aggregate(
                avg_score=Avg(F('rounds__matches__player1_score') + F('rounds__matches__player2_score') / 2)
            )['avg_score']

            monthly_data[calendar.month_name[month]] = {
                'total_tournaments': monthly_tournaments.count(),
                'completed_tournaments': completed_tournaments,
                'win_rate': win_rate,
                'average_score': avg_score,
            }

        return Response(monthly_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='round-difficulty-analysis')
    def round_difficulty_analysis(self, request):
        """
        Analysis of tournament round difficulty.
        Includes average score difference per round and round-by-round survival rate.
        """
        rounds_data = Round.objects.annotate(
            avg_score_diff=Avg(Abs(F('matches__player1_score') - F('matches__player2_score'))),
            survival_rate=Count('matches', filter=Q(matches__status='completed')) / Count('matches')
        ).values('stage', 'avg_score_diff', 'survival_rate')

        round_difficulty = {}
        for round in rounds_data:
            stage = round['stage']
            if stage not in round_difficulty:
                round_difficulty[stage] = []
            round_difficulty[stage].append({
                'average_score_difference': round['avg_score_diff'],
                'survival_rate': round['survival_rate']
            })

        return Response(round_difficulty, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='advanced-scoring-analytics')
    def advanced_scoring_analytics(self, request):
        """
        Detailed scoring analytics for tournaments, including high/low scores, score gaps, and score distributions.
        """
        highest_score = Match.objects.aggregate(
            high_score=Max(F('player1_score') + F('player2_score'))
        )['high_score']
        lowest_score = Match.objects.aggregate(
            low_score=Min(F('player1_score') + F('player2_score'))
        )['low_score']
        avg_score_gap = Match.objects.aggregate(
            avg_gap=Avg(Abs(F('player1_score') - F('player2_score')))
        )['avg_gap']
        score_distribution = Match.objects.values('player1_score', 'player2_score').annotate(
            frequency=Count('id')
        ).order_by('-frequency')

        data = {
            'highest_score': highest_score,
            'lowest_score': lowest_score,
            'average_score_gap': avg_score_gap,
            'score_distribution': list(score_distribution),
        }
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='tournament-participation-metrics')
    def tournament_participation_metrics(self, request):
        """
        Detailed metrics on tournament participation, including average rounds per participant,
        average matches played, and most frequent participants.
        """
        avg_rounds_per_participant = Round.objects.aggregate(
            avg_rounds=Avg('tournaments__all_participants__length')
        )['avg_rounds']
        
        avg_matches_per_participant = Match.objects.aggregate(
            avg_matches=Avg(Cast('player1_score', FloatField())) + Avg(Cast('player2_score', FloatField()))
        )['avg_matches']
        
        most_frequent_participants = User.objects.annotate(
            tournament_count=Count('hosted_tournaments')
        ).order_by('-tournament_count')[:10]

        data = {
            'average_rounds_per_participant': avg_rounds_per_participant,
            'average_matches_per_participant': avg_matches_per_participant,
            'most_frequent_participants': [
                {'username': user.username, 'tournament_count': user.tournament_count}
                for user in most_frequent_participants
            ],
        }
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='advanced-stage-analytics')
    def advanced_stage_analytics(self, request):
        """
        Advanced analytics by tournament stage, including stage-based win rates, average scores, and longest matches.
        """
        stage_analytics = {}
        stages = Round.objects.values('stage').annotate(
            avg_win_rate=Avg(Case(When(matches__outcome='Finished', then=1), default=0)),
            avg_stage_score=Avg(F('matches__player1_score') + F('matches__player2_score') / 2),
            longest_match=Max('matches__duration')
        )

        for stage in stages:
            stage_analytics[stage['stage']] = {
                'average_win_rate': stage['avg_win_rate'],
                'average_score': stage['avg_stage_score'],
                'longest_match_duration': stage['longest_match'],
            }

        return Response(stage_analytics, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='tournament-type-performance')
    def tournament_type_performance(self, request):
        """
        Performance metrics based on tournament type, with insights on win rates,
        average score gaps, and number of tournaments per type.
        """
        type_performance = {}
        types = Tournament.objects.values('type').annotate(
            type_count=Count('id'),
            avg_win_rate=Avg(Case(When(status='completed', then=1), default=0)),
            avg_score_gap=Avg(Abs(F('rounds__matches__player1_score') - F('rounds__matches__player2_score')))
        )

        for t in types:
            type_performance[t['type']] = {
                'total_tournaments': t['type_count'],
                'average_win_rate': t['avg_win_rate'],
                'average_score_gap': t['avg_score_gap'],
            }

        return Response(type_performance, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='time-based-performance')
    def time_based_performance(self, request):
        """
        Tournament performance by time of day and peak times for tournaments.
        """
        time_of_day_stats = {
            'morning': {'start': 6, 'end': 12, 'count': 0},
            'afternoon': {'start': 12, 'end': 18, 'count': 0},
            'evening': {'start': 18, 'end': 24, 'count': 0},
            'night': {'start': 0, 'end': 6, 'count': 0},
        }
        peak_time = None
        peak_count = 0

        # Calculate tournament counts by time period
        for period, times in time_of_day_stats.items():
            tournaments_in_period = Tournament.objects.filter(
                start_time__hour__gte=times['start'],
                start_time__hour__lt=times['end']
            ).count()
            time_of_day_stats[period]['count'] = tournaments_in_period

            # Identify the peak time period
            if tournaments_in_period > peak_count:
                peak_time = period
                peak_count = tournaments_in_period

        # Add peak time to the results
        time_of_day_stats['peak_time'] = peak_time

        # Return the result as a Response
        return Response(time_of_day_stats, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='round-based-analysis')
    def round_based_analysis(self, request):
        """
        Detailed analysis of tournament rounds.
        Calculates average number of rounds, average duration per round,
        and the most competitive stage.
        """
        total_rounds = Round.objects.count()
        avg_rounds_per_tournament = Tournament.objects.annotate(round_count=Count('rounds')).aggregate(
            avg_rounds=Avg('round_count')
        )['avg_rounds']
        avg_round_duration = Round.objects.aggregate(avg_duration=Avg('duration'))['avg_duration']
        most_competitive_stage = Round.objects.values('stage').annotate(
            avg_score_diff=Avg(Abs(F('matches__player1_score') - F('matches__player2_score')))
        ).order_by('avg_score_diff').first()

        data = {
            'total_rounds': total_rounds,
            'average_rounds_per_tournament': avg_rounds_per_tournament,
            'average_round_duration': avg_round_duration,
            'most_competitive_stage': {
                'stage': most_competitive_stage['stage'],
                'average_score_difference': most_competitive_stage['avg_score_diff'],
            } if most_competitive_stage else None,
        }
        return Response(data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='stage-performance')
    def stage_performance(self, request):
        """
        Performance data for each tournament stage, including average number of matches,
        duration, and typical win rates by stage.
        """
        stage_data = {}
        
        # Subquery to count matches for each Round
        match_count_subquery = Match.objects.filter(rounds=OuterRef('pk')).values('rounds').annotate(
            match_count=Count('id')
        ).values('match_count')
        
        stages = Round.objects.values('stage').annotate(
            total_rounds=Count('id'),
            avg_matches=Avg(Subquery(match_count_subquery, output_field=IntegerField())),
            avg_duration=Avg('duration'),
            win_rate=Avg(
                Case(
                    When(matches__outcome='Finished', then=1),
                    default=0,
                    output_field=IntegerField()
                )
            )
        )

        for stage in stages:
            stage_data[stage['stage']] = {
                'total_rounds': stage['total_rounds'],
                'average_matches_per_round': stage['avg_matches'],
                'average_duration': stage['avg_duration'],
                'win_rate': stage['win_rate'],
            }

        return Response(stage_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='tournament-type-breakdown')
    def tournament_type_breakdown(self, request):
        """
        Breakdown of tournaments by type and format (e.g., single elimination, round-robin),
        along with win rate for each type.
        """
        type_data = {}
        types = Tournament.objects.values('type').annotate(
            count=Count('id'),
            win_rate=Avg(
                Case(
                    When(status='completed', then=1),
                    default=0,
                    output_field=IntegerField()
                )
            )
        )

        for t in types:
            type_data[t['type']] = {
                'total_tournaments': t['count'],
                'win_rate': t['win_rate']
            }

        return Response(type_data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='match-outcomes')
    def match_outcomes(self, request):
        """
        Detailed statistics on match outcomes, including ties, highest scoring matches,
        average score difference, and outcomes by tournament type.
        """
        total_matches = Match.objects.count()
        completed_matches = Match.objects.filter(status='completed').count()
        tied_matches = Match.objects.filter(outcome='Tie').count()
        avg_score_diff = Match.objects.aggregate(
            avg_score_diff=Avg(Abs(F('player1_score') - F('player2_score')))
        )['avg_score_diff']
        highest_scoring_match = Match.objects.order_by('-player1_score', '-player2_score').first()

        data = {
            'total_matches': total_matches,
            'completed_matches': completed_matches,
            'tied_matches': tied_matches,
            'tie_rate': (tied_matches / total_matches) * 100 if total_matches > 0 else 0,
            'average_score_difference': avg_score_diff,
            'highest_scoring_match': {
                'player1': highest_scoring_match.player1,
                'player2': highest_scoring_match.player2,
                'player1_score': highest_scoring_match.player1_score,
                'player2_score': highest_scoring_match.player2_score,
            } if highest_scoring_match else None,
        }
        return Response(data, status=status.HTTP_200_OK)

        
        
def generate_room_id(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

class LobbyViewSet(viewsets.ViewSet):
    
    @action(detail=False, methods=['post'])
    def create_room(self, request):
        room_id = generate_room_id()
        host = request.user
        self.clear_existing_user_rooms(host)
        # Get settings from the request
        max_rounds = request.data.get("maxRounds", 3)
        round_score_limit = request.data.get("roundScoreLimit", 3)

        # Create lobby with additional settings
        lobby = Lobby.objects.create(
            room_id=room_id,
            host=host,
            max_rounds=max_rounds,
            round_score_limit=round_score_limit
        )

        return Response({"room_id": room_id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    @transaction.atomic  # Ensures that the following changes are atomic
    def join_room(self, request):
        room_id = request.data.get("room_id")
        user = request.user

        try:
            # Try to fetch the requested lobby
            lobby = Lobby.objects.get(room_id=room_id, is_active=True)

            # Check if the user is the host; if so, ignore the request
            if lobby.host == user:
                return Response(
                    {"detail": "You are already the host of this room."},
                    status=status.HTTP_200_OK
                )

            # Check if the user is already the guest; if so, allow them to rejoin without modification
            if lobby.guest == user:
                return Response(
                    {"detail": "You are already the guest in this room."},
                    status=status.HTTP_200_OK
                )

            # Check if the lobby is full (has a guest already)
            if lobby.is_full():
                return Response({"detail": "Room is full"}, status=status.HTTP_400_BAD_REQUEST)

            # If the user is not the host or current guest, set them as the guest
            # First, clear any other room associations for the user
            self.remove_user_from_other_rooms(user)

            # Add the user as a guest to the room
            lobby.guest = user
            lobby.save()

            return Response(
                {"detail": "Joined room successfully. You were removed from any other active rooms."},
                status=status.HTTP_200_OK
            )

        except Lobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

    def remove_user_from_other_rooms(self, user):
        """Removes the user from any rooms they are currently in."""
        # Remove user from any room where they are a guest
        Lobby.objects.filter(guest=user).update(guest=None, is_guest_ready=False)
        
        # Optional: If a user can host and join rooms simultaneously and needs to be removed as a host too
        # Lobby.objects.filter(host=user).delete()  # Uncomment if needed
        
    def clear_existing_user_rooms(self, user):
        """Clears any existing room associations for the user before creating a new one."""
        # Remove the user as a guest from any existing lobbies
        Lobby.objects.filter(guest=user).update(guest=None, is_guest_ready=False)

        # Delete any lobbies where the user is the host
        Lobby.objects.filter(host=user).delete()

    @action(detail=False, methods=['post'])
    def set_ready(self, request):
        room_id = request.data.get("room_id")
        is_ready = request.data.get("is_ready", False)

        try:
            lobby = Lobby.objects.get(room_id=room_id, is_active=True)
            if request.user == lobby.host:
                lobby.is_host_ready = is_ready
            elif request.user == lobby.guest:
                lobby.is_guest_ready = is_ready
            else:
                return Response({"detail": "Not part of this lobby"}, status=status.HTTP_400_BAD_REQUEST)

            lobby.save()
            return Response({"detail": "Ready status updated"}, status=status.HTTP_200_OK)
        except Lobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'], url_path='status/(?P<room_id>[^/.]+)')
    def room_status(self, request, room_id=None):
        try:
            lobby = Lobby.objects.get(room_id=room_id)
            return Response({
                "room_id": room_id,
                "is_active": lobby.is_active,
                "host": lobby.host.username,
                "guest": lobby.guest.username if lobby.guest else None,
                "is_host_ready": lobby.is_host_ready,
                "is_guest_ready": lobby.is_guest_ready,
                "all_ready": lobby.all_ready(),
                "is_full": lobby.is_full(),
                "max_rounds": lobby.max_rounds,
                "round_score_limit": lobby.round_score_limit
            }, status=status.HTTP_200_OK)
        except Lobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)
        
    @action(detail=False, methods=['get'])
    def list_rooms(self, request):
        """
        Returns a list of all available rooms with host and guest information.
        """
        rooms = Lobby.objects.filter(is_active=True)
        data = [
            {
                "room_id": room.room_id,
                "host": room.host.username,
                "guest": room.guest.username if room.guest else None,
                "is_host_ready": room.is_host_ready,
                "is_guest_ready": room.is_guest_ready,
                "is_full": room.is_full(),
                "all_ready": room.all_ready(),
                "max_rounds": room.max_rounds,
                "round_score_limit": room.round_score_limit
            }
            for room in rooms
        ]
        return Response(data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['delete'], url_path='delete/(?P<room_id>[^/.]+)')
    def delete_room(self, request, room_id=None):
        """
        Deletes the lobby if the requesting user is the host.
        """
        try:
            # Attempt to retrieve the lobby by room_id
            lobby = Lobby.objects.get(room_id=room_id, is_active=True)

            # Check if the requesting user is the host
            if request.user != lobby.host:
                return Response({"detail": "Only the host can delete this room."}, status=status.HTTP_403_FORBIDDEN)

            # Delete the lobby if the user is the host
            lobby.delete()
            return Response({"detail": "Lobby deleted successfully."}, status=status.HTTP_200_OK)

        except Lobby.DoesNotExist:
            return Response({"detail": "Room not found or is not active."}, status=status.HTTP_404_NOT_FOUND)