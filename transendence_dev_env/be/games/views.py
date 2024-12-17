from rest_framework import viewsets, permissions, status, serializers
from .serializers import GameSerializer, GlobalStatsSerializer, UserStatsSerializer
from django.db.models.functions import ExtractMonth
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
from accounts.models import Profile
from .models import Tournament, Match, Round, Game, Lobby, ChaosLobby, ArenaLobby, Stage, TournamentType, MatchOutcome
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
        elif game.game_mode == Game.ONLINE_PVP:
            mode_multiplier = 1.1 if not is_winner else 1.3  # Online PvP, higher reward for higher challenge
        else:
            mode_multiplier = 1.2 if not is_winner else 1.5  # Online Chaos PVP, highest reward for win

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
        data = self.request.data
        game_mode = data.get('game_mode')

        save_kwargs = {'player1': self.request.user}

        # Handle player2
        player2 = data.get('player2', {})
        if player2.get('id') == 0:
            save_kwargs['player2_name_pvp_local'] = player2.get('username', 'Player 2')
        else:
            try:
                user2 = User.objects.get(id=player2.get('id'))
                save_kwargs['player2'] = user2
            except User.DoesNotExist:
                raise serializers.ValidationError({"player2": "Invalid user id."})

        # Handle player3 and player4 for arena modes
        if game_mode in [Game.ARENA_PVP, Game.ONLINE_ARENA_PVP]:
            # Handle player3
            player3 = data.get('player3', {})
            if player3.get('id') == 0:
                save_kwargs['player3_name_pvp_local'] = player3.get('username', 'Player 3')
            elif player3.get('id') is not None:
                try:
                    user3 = User.objects.get(id=player3.get('id'))
                    save_kwargs['player3'] = user3
                except User.DoesNotExist:
                    raise serializers.ValidationError({"player3": "Invalid user id."})

            # Handle player4
            player4 = data.get('player4', {})
            if player4.get('id') == 0:
                save_kwargs['player4_name_pvp_local'] = player4.get('username', 'Player 4')
            elif player4.get('id') is not None:
                try:
                    user4 = User.objects.get(id=player4.get('id'))
                    save_kwargs['player4'] = user4
                except User.DoesNotExist:
                    raise serializers.ValidationError({"player4": "Invalid user id."})

        # Save the game instance
        game = serializer.save(**save_kwargs)
        return Response(GameSerializer(game).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        instance = self.get_object()
        data = serializer.validated_data
        winner, loser = None, None
        game_mode = data.get('game_mode', instance.game_mode)
        winner_xp, loser_xp = 0, 0

        # Update player2_name if provided in local PvP or Chaos PvP mode
        if game_mode in [Game.LOCAL_PVP, Game.CHAOS_PVP] and data.get('player2', {}).get('id') == 0:
            instance.player2_name_pvp_local = data.get('player2', {}).get('username')

        if data.get('is_completed', False):
            # Calculate and set duration if not already set
            instance.duration = instance.duration or (timezone.now() - instance.start_time).total_seconds()

            # Determine winner and loser
            score_player1 = data.get('score_player1', instance.score_player1)
            score_player2 = data.get('score_player2', instance.score_player2)

            if instance.is_against_ai():  # PvE mode
                if score_player1 > score_player2:
                    winner = instance.player1
                else:
                    winner = {"id": 0, "username": "AI"}  # AI is the winner
            else:  # PvP mode (includes Local PvP)
                if isinstance(instance.player2, User):  # player2 is a real user
                    if score_player1 > score_player2:
                        winner, loser = instance.player1, instance.player2
                    elif score_player2 > score_player1:
                        winner, loser = instance.player2, instance.player1
                elif instance.game_mode in [Game.LOCAL_PVP, Game.CHAOS_PVP] and instance.player2_name_pvp_local:
                    # Local PvP with placeholder player2 name
                    if score_player1 > score_player2:
                        winner = instance.player1
                    else:
                        winner = {"id": 0, "username": instance.player2_name_pvp_local}  # Named player2 as winner

            # Calculate XP gain for the winner and loser
            if isinstance(winner, User):
                winner_xp = self.calculate_xp_gain(instance, winner, is_winner=True)

            if isinstance(loser, User):
                # Loser gets a fraction of XP; ensure they get at least a minimum amount
                loser_xp = max(10, self.calculate_xp_gain(instance, loser, is_winner=False) // 4)

            # Save game with end time, duration, and winner
            serializer.save(end_time=timezone.now(), duration=instance.duration, winner=winner if isinstance(winner, User) else None)

            # Apply XP to profiles if winner and loser are actual User instances
            if isinstance(winner, User):
                winner.profile.add_xp(winner_xp)
            if isinstance(loser, User):
                loser.profile.add_xp(loser_xp)

        else:
            serializer.save()
            
    @action(detail=False, methods=['get'], url_path='all-games')
    def all_games(self, request):
        """
        Custom action to retrieve all games.
        Accessible via the URL path 'all-games'.
        """
        games = Game.objects.all()
        serializer = self.get_serializer(games, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
            

    @action(detail=False, methods=['get'], url_path='by-user/(?P<user_id>\d+)')
    def get_games_by_user(self, request, user_id=None):
        """
        Custom endpoint to retrieve all games where a specific user (user_id) is a player.
        """
        games = Game.objects.filter(models.Q(player1_id=user_id) | models.Q(player2_id=user_id) | models.Q(player3_id=user_id) | models.Q(player4_id=user_id))
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
                "player2": game.player2.username if game.player2 else "AI",
                "player3": game.player3.username if game.player3 else None,
                "player4": game.player4.username if game.player4 else None
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
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

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
    

        
        
def generate_room_id(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

class LobbyViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

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

    def room_status(self, request, room_id=None):
        try:
            lobby = Lobby.objects.get(room_id=room_id)

            # Host's profile
            host_profile = lobby.host.profile
            host_paddle_image = host_profile.paddleskin_image.url if host_profile.paddleskin_image else None
            host_paddle_color = host_profile.paddleskin_color or "#FFFFFF"  # Default color

            # Guest's profile (if guest exists)
            guest_profile = lobby.guest.profile if lobby.guest else None
            guest_paddle_image = guest_profile.paddleskin_image.url if guest_profile and guest_profile.paddleskin_image else None
            guest_paddle_color = guest_profile.paddleskin_color or "#FFFFFF" if guest_profile else None

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
                "round_score_limit": lobby.round_score_limit,
                "paddleskin_color_left": host_paddle_color,
                "paddleskin_color_right": guest_paddle_color,
                "paddleskin_image_left": host_paddle_image,
                "paddleskin_image_right": guest_paddle_image,
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

class ChaosLobbyViewSet(viewsets.ViewSet):
    @action(detail=False, methods=['post'])
    def create_room(self, request):
        room_id = generate_room_id()
        host = request.user
        self.clear_existing_user_rooms(host)
        # Get settings from the request
        max_rounds = request.data.get("maxRounds", 3)
        round_score_limit = request.data.get("roundScoreLimit", 3)
        powerup_spawn_rate = request.data.get("powerupSpawnRate", 10)

        # Create lobby with additional settings
        lobby = ChaosLobby.objects.create(
            room_id=room_id,
            host=host,
            max_rounds=max_rounds,
            round_score_limit=round_score_limit,
            powerup_spawn_rate=powerup_spawn_rate
        )

        return Response({"room_id": room_id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    @transaction.atomic  # Ensures that the following changes are atomic
    def join_room(self, request):
        room_id = request.data.get("room_id")
        user = request.user

        try:
            # Try to fetch the requested lobby
            lobby = ChaosLobby.objects.get(room_id=room_id, is_active=True)

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

        except ChaosLobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

    def remove_user_from_other_rooms(self, user):
        """Removes the user from any rooms they are currently in."""
        # Remove user from any room where they are a guest
        ChaosLobby.objects.filter(guest=user).update(guest=None, is_guest_ready=False)
        
        # Optional: If a user can host and join rooms simultaneously and needs to be removed as a host too
        # Lobby.objects.filter(host=user).delete()  # Uncomment if needed
        
    def clear_existing_user_rooms(self, user):
        """Clears any existing room associations for the user before creating a new one."""
        # Remove the user as a guest from any existing lobbies
        ChaosLobby.objects.filter(guest=user).update(guest=None, is_guest_ready=False)

        # Delete any lobbies where the user is the host
        ChaosLobby.objects.filter(host=user).delete()

    @action(detail=False, methods=['post'])
    def set_ready(self, request):
        room_id = request.data.get("room_id")
        is_ready = request.data.get("is_ready", False)

        try:
            lobby = ChaosLobby.objects.get(room_id=room_id, is_active=True)
            if request.user == lobby.host:
                lobby.is_host_ready = is_ready
            elif request.user == lobby.guest:
                lobby.is_guest_ready = is_ready
            else:
                return Response({"detail": "Not part of this lobby"}, status=status.HTTP_400_BAD_REQUEST)

            lobby.save()
            return Response({"detail": "Ready status updated"}, status=status.HTTP_200_OK)
        except ChaosLobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

    def room_status(self, request, room_id=None):
        try:
            lobby = ChaosLobby.objects.get(room_id=room_id)

            # Host's profile
            host_profile = lobby.host.profile
            host_paddle_image = host_profile.paddleskin_image.url if host_profile.paddleskin_image else None
            host_paddle_color = host_profile.paddleskin_color or "#FFFFFF"  # Default color

            # Guest's profile (if guest exists)
            guest_profile = lobby.guest.profile if lobby.guest else None
            guest_paddle_image = guest_profile.paddleskin_image.url if guest_profile and guest_profile.paddleskin_image else None
            guest_paddle_color = guest_profile.paddleskin_color or "#FFFFFF" if guest_profile else None

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
                "round_score_limit": lobby.round_score_limit,
                "powerup_spawn_rate": lobby.powerup_spawn_rate,
                "paddleskin_color_left": host_paddle_color,
                "paddleskin_color_right": guest_paddle_color,
                "paddleskin_image_left": host_paddle_image,
                "paddleskin_image_right": guest_paddle_image,
            }, status=status.HTTP_200_OK)
        except ChaosLobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)
        
    @action(detail=False, methods=['get'])
    def list_rooms(self, request):
        """
        Returns a list of all available rooms with host and guest information.
        """
        rooms = ChaosLobby.objects.filter(is_active=True)
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
                "round_score_limit": room.round_score_limit,
                "powerup_spawn_rate": room.powerup_spawn_rate
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
            lobby = ChaosLobby.objects.get(room_id=room_id, is_active=True)

            # Check if the requesting user is the host
            if request.user != lobby.host:
                return Response({"detail": "Only the host can delete this room."}, status=status.HTTP_403_FORBIDDEN)

            # Delete the lobby if the user is the host
            lobby.delete()
            return Response({"detail": "Lobby deleted successfully."}, status=status.HTTP_200_OK)

        except ChaosLobby.DoesNotExist:
            return Response({"detail": "Room not found or is not active."}, status=status.HTTP_404_NOT_FOUND)

class ArenaLobbyViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['post'])
    def create_room(self, request):
        room_id = generate_room_id()
        host = request.user
        self.clear_existing_user_rooms(host)

        # Get settings from the request
        max_rounds = request.data.get("maxRounds", 3)
        round_score_limit = request.data.get("roundScoreLimit", 3)

        # Create an ArenaLobby with the host as player_one
        lobby = ArenaLobby.objects.create(
            room_id=room_id,
            player_one=host,
            max_rounds=max_rounds,
            round_score_limit=round_score_limit
        )

        return Response({"room_id": room_id}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    @transaction.atomic
    def join_room(self, request):
        room_id = request.data.get("room_id")
        user = request.user

        try:
            lobby = ArenaLobby.objects.get(room_id=room_id, is_active=True)

            # Check if user is already the host (player_one)
            if lobby.player_one == user:
                return Response({"detail": "You are already the host of this room."},
                                status=status.HTTP_200_OK)

            # Check if user is already in the lobby in any slot
            if (lobby.player_two == user or
                lobby.player_three == user or
                lobby.player_four == user):
                return Response({"detail": "You are already in this room."}, 
                                status=status.HTTP_200_OK)

            # Check if the lobby is full
            if lobby.is_full():
                return Response({"detail": "Room is full"}, status=status.HTTP_400_BAD_REQUEST)

            # Remove the user from any other lobbies
            self.remove_user_from_other_rooms(user)

            # Assign user to the first available player slot
            if lobby.player_two is None:
                lobby.player_two = user
            elif lobby.player_three is None:
                lobby.player_three = user
            elif lobby.player_four is None:
                lobby.player_four = user

            lobby.save()

            return Response({"detail": "Joined room successfully. You were removed from any other active rooms."},
                            status=status.HTTP_200_OK)

        except ArenaLobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

    def remove_user_from_other_rooms(self, user):
        """Removes the user from any rooms they are currently in as any player."""
        # Clear the user if they appear in any of these player slots
        ArenaLobby.objects.filter(player_two=user).update(player_two=None, is_player_two_ready=False)
        ArenaLobby.objects.filter(player_three=user).update(player_three=None, is_player_three_ready=False)
        ArenaLobby.objects.filter(player_four=user).update(player_four=None, is_player_four_ready=False)
        
        # If needed, remove as host from other active lobbies
        # ArenaLobby.objects.filter(player_one=user).delete()

    def clear_existing_user_rooms(self, user):
        """Clears any existing room associations for the user before creating a new one as host."""
        # Remove the user from any player slots in other lobbies
        ArenaLobby.objects.filter(player_two=user).update(player_two=None, is_player_two_ready=False)
        ArenaLobby.objects.filter(player_three=user).update(player_three=None, is_player_three_ready=False)
        ArenaLobby.objects.filter(player_four=user).update(player_four=None, is_player_four_ready=False)

        # Delete any lobbies where the user is the host
        ArenaLobby.objects.filter(player_one=user).delete()

    @action(detail=False, methods=['post'])
    def set_ready(self, request):
        room_id = request.data.get("room_id")
        is_ready = request.data.get("is_ready", False)

        try:
            lobby = ArenaLobby.objects.get(room_id=room_id, is_active=True)
            user = request.user

            # Use the lobby's method to set ready status
            if user in [lobby.player_one, lobby.player_two, lobby.player_three, lobby.player_four]:
                lobby.set_ready_status(user, is_ready)
                return Response({"detail": "Ready status updated"}, status=status.HTTP_200_OK)
            else:
                return Response({"detail": "Not part of this lobby"}, status=status.HTTP_400_BAD_REQUEST)

        except ArenaLobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

    def room_status(self, request, room_id=None):
        try:
            lobby = ArenaLobby.objects.get(room_id=room_id)

            player_one_profile = lobby.player_one.profile # Host is guaranteed to exist
            player_one_paddle_image = player_one_profile.paddleskin_image.url if player_one_profile.paddleskin_image else None
            player_one_paddle_color = player_one_profile.paddleskin_color or "#FFFFFF"

            player_two_profile = lobby.player_two.profile if lobby.player_two else None
            player_two_paddle_image = player_two_profile.paddleskin_image.url if player_two_profile and player_two_profile.paddleskin_image else None
            player_two_paddle_color = player_two_profile.paddleskin_color or "#FFFFFF" if player_two_profile else None

            player_three_profile = lobby.player_three.profile if lobby.player_three else None
            player_three_paddle_image = player_three_profile.paddleskin_image.url if player_three_profile and player_three_profile.paddleskin_image else None
            player_three_paddle_color = player_three_profile.paddleskin_color or "#FFFFFF" if player_three_profile else None

            player_four_profile = lobby.player_four.profile if lobby.player_four else None
            player_four_paddle_image = player_four_profile.paddleskin_image.url if player_four_profile and player_four_profile.paddleskin_image else None
            player_four_paddle_color = player_four_profile.paddleskin_color or "#FFFFFF" if player_four_profile else None

            # Append paddle colors and images to the state
            return Response({
                "room_id": room_id,
                "is_active": lobby.is_active,
                "player_one": lobby.player_one.username,
                "player_two": lobby.player_two.username if lobby.player_two else None,
                "player_three": lobby.player_three.username if lobby.player_three else None,
                "player_four": lobby.player_four.username if lobby.player_four else None,
                "is_player_one_ready": lobby.is_player_one_ready,
                "is_player_two_ready": lobby.is_player_two_ready,
                "is_player_three_ready": lobby.is_player_three_ready,
                "is_player_four_ready": lobby.is_player_four_ready,
                "all_ready": lobby.all_ready(),
                "is_full": lobby.is_full(),
                "max_rounds": lobby.max_rounds,
                "round_score_limit": lobby.round_score_limit,
                "paddleskin_color_left": player_one_paddle_color,
                "paddleskin_color_right": player_two_paddle_color,
                "paddleskin_color_top": player_three_paddle_color,
                "paddleskin_color_bottom": player_four_paddle_color,
                "paddleskin_image_left": player_one_paddle_image,
                "paddleskin_image_right": player_two_paddle_image,
                "paddleskin_image_top": player_three_paddle_image,
                "paddleskin_image_bottom": player_four_paddle_image,
            }, status=status.HTTP_200_OK)

        except ArenaLobby.DoesNotExist:
            return Response({"detail": "Room not found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def list_rooms(self, request):
        """
        Returns a list of all available rooms with host and guest information.
        """
        rooms = ArenaLobby.objects.filter(is_active=True)
        data = [
            {
                "room_id": room.room_id,
                "is_active": room.is_active,
                "player_one": room.player_one.username,
                "player_two": room.player_two.username if room.player_two else None,
                "player_three": room.player_three.username if room.player_three else None,
                "player_four": room.player_four.username if room.player_four else None,
                "is_player_one_ready": room.is_player_one_ready,
                "is_player_two_ready": room.is_player_two_ready,
                "is_player_three_ready": room.is_player_three_ready,
                "is_player_four_ready": room.is_player_four_ready,
                "all_ready": room.all_ready(),
                "is_full": room.is_full(),
                "max_rounds": room.max_rounds,
                "round_score_limit": room.round_score_limit,
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


class StatsViewSet(viewsets.ViewSet):
    """
    A viewset for retrieving user-specific and global statistics.
    """

    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['get'], url_path='user-stats')
    def user_stats(self, request, pk=None):
        """
        Retrieve statistics for a specific user by user ID.
        Endpoint: /stats/{user_id}/user-stats/
        """
        user = request.user
        # Access control: Only the user themselves or admins can access the stats
        # if not (user.id == int(pk) or user.is_staff):
        #     return Response(
        #         {"error": "You do not have permission to view this user's stats."},
        #         status=status.HTTP_403_FORBIDDEN
        #     )
        try:
            target_user = User.objects.select_related('profile').get(pk=pk)
            profile = target_user.profile
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND
            )
        except Profile.DoesNotExist:
            return Response(
                {"error": "Profile not found for the user."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Aggregations for games
        games_played = Game.objects.filter(Q(player1=target_user) | Q(player2=target_user))
        total_games_played = games_played.count()
        total_games_pve = games_played.filter(game_mode=Game.PVE).count()
        total_games_pvp_local = games_played.filter(game_mode=Game.LOCAL_PVP).count()
        total_games_pvp_online = games_played.filter(game_mode=Game.ONLINE_PVP).count()
        # New Game Modes
        total_games_chaos_pve = games_played.filter(game_mode=Game.CHAOS_PVE).count()
        total_games_chaos_pvp = games_played.filter(game_mode=Game.CHAOS_PVP).count()
        total_games_online_chaos_pvp = games_played.filter(game_mode=Game.ONLINE_CHAOS_PVP).count()
        total_games_arena_pvp = games_played.filter(game_mode=Game.ARENA_PVP).count()
        total_games_online_arena_pvp = games_played.filter(game_mode=Game.ONLINE_ARENA_PVP).count()

        total_games_won = games_played.filter(winner=target_user).count()
        total_games_lost = total_games_played - total_games_won
        average_game_duration = games_played.aggregate(avg_duration=Avg('duration'))['avg_duration'] or 0.0

        # Aggregations for tournaments
        tournaments_participated = Tournament.objects.filter(
            Q(host=target_user) | Q(all_participants__contains=[target_user.username])
        )
        total_tournaments_participated = tournaments_participated.count()
        total_tournaments_won = tournaments_participated.filter(final_winner=target_user.username).count()
        average_tournament_duration = tournaments_participated.aggregate(avg_duration=Avg('duration'))['avg_duration'] or 0.0

        # Calculate Ranks
        # Enhanced Rank by XP considering both level and XP
        rank_by_xp = User.objects.filter(
            Q(profile__level__gt=profile.level) |
            Q(profile__level=profile.level, profile__xp__gt=profile.xp)
        ).count() + 1

        # Rank by Wins
        rank_by_wins = User.objects.annotate(
            total_wins=Count('games_won')
        ).filter(total_wins__gt=total_games_won).count() + 1

        # Rank by Games Played
        rank_by_games_played = Profile.objects.filter(games_played__gt=total_games_played).count() + 1

        # Rank by Tournament Wins
        rank_by_tournament_wins = User.objects.annotate(
            tournament_wins=Count(
                'hosted_tournaments',
                filter=Q(hosted_tournaments__final_winner=F('username'))
            )
        ).filter(tournament_wins__gt=total_tournaments_won).count() + 1

        data = {
            "user_id": target_user.id,
            "username": target_user.username,
            "display_name": profile.display_name,
            "level": profile.level,
            "xp": profile.xp,
            "total_games_played": total_games_played,
            "total_games_pve": total_games_pve,
            "total_games_pvp_local": total_games_pvp_local,
            "total_games_pvp_online": total_games_pvp_online,
            # New Game Modes
            "total_games_chaos_pve": total_games_chaos_pve,
            "total_games_chaos_pvp": total_games_chaos_pvp,
            "total_games_online_chaos_pvp": total_games_online_chaos_pvp,
            "total_games_arena_pvp": total_games_arena_pvp,
            "total_games_online_arena_pvp": total_games_online_arena_pvp,
            "total_games_won": total_games_won,
            "total_games_lost": total_games_lost,
            "average_game_duration": round(average_game_duration, 2),
            "total_tournaments_participated": total_tournaments_participated,
            "total_tournaments_won": total_tournaments_won,
            "average_tournament_duration": round(average_tournament_duration, 2),
            # Ranking Fields
            "rank_by_xp": rank_by_xp,
            "rank_by_wins": rank_by_wins,
            "rank_by_games_played": rank_by_games_played,
            "rank_by_tournament_wins": rank_by_tournament_wins,
        }
        serializer = UserStatsSerializer(instance=data)  # Use instance instead of data
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='global-stats')
    def global_stats(self, request):
        """
        Retrieve global statistics across all users.
        Endpoint: /stats/global-stats/
        """
        total_users = User.objects.count()
        total_games = Game.objects.count()
        total_pve_games = Game.objects.filter(game_mode=Game.PVE).count()
        total_pvp_local_games = Game.objects.filter(game_mode=Game.LOCAL_PVP).count()
        total_pvp_online_games = Game.objects.filter(game_mode=Game.ONLINE_PVP).count()
        # New Game Modes
        total_chaos_pve_games = Game.objects.filter(game_mode=Game.CHAOS_PVE).count()
        total_chaos_pvp_games = Game.objects.filter(game_mode=Game.CHAOS_PVP).count()
        total_online_chaos_pvp_games = Game.objects.filter(game_mode=Game.ONLINE_CHAOS_PVP).count()
        total_arena_pvp_games = Game.objects.filter(game_mode=Game.ARENA_PVP).count()
        total_online_arena_pvp_games = Game.objects.filter(game_mode=Game.ONLINE_ARENA_PVP).count()

        total_tournaments = Tournament.objects.count()
        completed_tournaments = Tournament.objects.filter(status='completed').count()

        # Calculate total games played by all users
        games_played_p1 = Game.objects.values('player1').annotate(total=Count('id')).aggregate(total_p1=Sum('total'))['total_p1'] or 0
        games_played_p2 = Game.objects.values('player2').annotate(total=Count('id')).aggregate(total_p2=Sum('total'))['total_p2'] or 0
        total_games_played = games_played_p1 + games_played_p2
        average_games_per_user = total_games_played / total_users if total_users > 0 else 0

        # Calculate total tournament participations
        # Assuming 'all_participants' is a JSONField containing a list of usernames
        # We need to aggregate the total number of participants across all tournaments
        total_tournament_participations = 0
        tournaments = Tournament.objects.exclude(all_participants__isnull=True)
        for tournament in tournaments:
            if tournament.all_participants:
                total_tournament_participations += len(tournament.all_participants)
        average_tournaments_per_user = total_tournament_participations / total_users if total_users > 0 else 0

        # Additional Global Stats
        # Calculate average game duration
        average_game_duration = Game.objects.aggregate(avg_duration=Avg('duration'))['avg_duration'] or 0.0

        # Calculate average tournament duration
        average_tournament_duration = Tournament.objects.aggregate(avg_duration=Avg('duration'))['avg_duration'] or 0.0

        # Leaderboards
        # Leaderboard by XP
        leaderboard_xp_qs = Profile.objects.select_related('user').order_by('-level', '-xp')[:10]
        leaderboard_xp = [
            {
                "rank": index + 1,
                "user_id": profile.user.id,
                "username": profile.user.username,
                "display_name": profile.display_name,
                "value": profile.xp
            }
            for index, profile in enumerate(leaderboard_xp_qs)
        ]

        # Leaderboard by Most Wins
        leaderboard_most_wins_qs = User.objects.annotate(total_wins=Count('games_won')).order_by('-total_wins')[:10]
        leaderboard_most_wins = [
            {
                "rank": index + 1,
                "user_id": user.id,
                "username": user.username,
                "display_name": user.profile.display_name,
                "value": user.games_won.count()
            }
            for index, user in enumerate(leaderboard_most_wins_qs)
        ]

        # Leaderboard by Most Games Played
        leaderboard_most_games_qs = Profile.objects.order_by('-games_played')[:10]
        leaderboard_most_games = [
            {
                "rank": index + 1,
                "user_id": profile.user.id,
                "username": profile.user.username,
                "display_name": profile.display_name,
                "value": profile.games_played
            }
            for index, profile in enumerate(leaderboard_most_games_qs)
        ]

        # Leaderboard by Most Tournament Wins
        leaderboard_most_tournament_wins_qs = User.objects.annotate(
            tournament_wins=Count(
                'hosted_tournaments',
                filter=Q(hosted_tournaments__final_winner=F('username'))
            )
        ).order_by('-tournament_wins')[:10]
        leaderboard_most_tournament_wins = [
            {
                "rank": index + 1,
                "user_id": user.id,
                "username": user.username,
                "display_name": user.profile.display_name,
                "value": user.hosted_tournaments.filter(final_winner=user.username).count()
            }
            for index, user in enumerate(leaderboard_most_tournament_wins_qs)
        ]

        data = {
            "total_users": total_users,
            "total_games": total_games,
            "total_pve_games": total_pve_games,
            "total_pvp_local_games": total_pvp_local_games,
            "total_pvp_online_games": total_pvp_online_games,
            # New Game Modes
            "total_chaos_pve_games": total_chaos_pve_games,
            "total_chaos_pvp_games": total_chaos_pvp_games,
            "total_online_chaos_pvp_games": total_online_chaos_pvp_games,
            "total_arena_pvp_games": total_arena_pvp_games,
            "total_online_arena_pvp_games": total_online_arena_pvp_games,
            "total_tournaments": total_tournaments,
            "completed_tournaments": completed_tournaments,
            "average_games_per_user": round(average_games_per_user, 2),
            "average_tournaments_per_user": round(average_tournaments_per_user, 2),
            "average_game_duration": round(average_game_duration, 2),
            "average_tournament_duration": round(average_tournament_duration, 2),
            # Leaderboards
            "leaderboard_xp": leaderboard_xp,
            "leaderboard_most_wins": leaderboard_most_wins,
            "leaderboard_most_games": leaderboard_most_games,
            "leaderboard_most_tournament_wins": leaderboard_most_tournament_wins,
        }
        serializer = GlobalStatsSerializer(instance=data)  # Use instance instead of data
        return Response(serializer.data, status=status.HTTP_200_OK)