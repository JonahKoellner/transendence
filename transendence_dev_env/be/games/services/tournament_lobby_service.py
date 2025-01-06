from ..models import OnlineTournament, OnlineMatch, OnlineRound, TournamentLobby, MatchOutcome
from .tournament_service import TournamentService
from .round_service import RoundService
from django.utils import timezone
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from random import shuffle
import math

class TournamentLobbyService:
    @staticmethod
    def start_tournament(lobby: TournamentLobby, user):
        if user != lobby.host:
            raise PermissionError("Only the host can start the tournament.")
        if not lobby.all_ready():
            raise ValueError("Not all players are ready.")
        tournament = OnlineTournament.objects.create(
            name=f"Tournament {lobby.room_id}",
            type=lobby.tournament_type,
            status="ongoing",
            room_id=lobby.room_id
        )
        tournament.participants.set(list(lobby.guests.all()) + [lobby.host])
        tournament.total_rounds = TournamentLobbyService.calc_max_rounds(len(tournament.participants.all()), lobby.tournament_type)
        tournament.save()
        rounds = RoundService.generate_rounds(tournament) # generates rounds and matches
        tournament.rounds.set(rounds)
        tournament.save()
        TournamentService.new_matchups(tournament, tournament.participants.all())
        lobby.tournament = tournament
        lobby.save()
        

    @staticmethod
    def handle_user_disconnect(user, lobby):
        if user == lobby.host:
            lobby.delete()
        elif user in lobby.guests.all():
            lobby.guests.remove(user)
        lobby.save()

    @staticmethod
    def get_lobby_state(lobby):
        return lobby.get_lobby_state()
    
    @staticmethod
    def adjust_max_player_count(lobby):
        """Ensures max_player_count is valid based on the game mode and player count."""
        player_count = lobby.guests.count() + 1  # Including the host
        allowed_counts = TournamentLobbyService.get_allowed_player_counts(lobby.tournament_type)

        # Determine the smallest valid max_player_count >= current player count
        valid_counts = [count for count in allowed_counts if count >= player_count]
        if valid_counts and lobby.max_player_count not in valid_counts:
            lobby.max_player_count = valid_counts[0]
        #TODO be sure that never max_player_count < player_count, otherwise add edge case handling
        lobby.save()

    @staticmethod
    def get_allowed_player_counts(tournament_type):
        """Returns allowed player counts for the given game mode."""
        game_modes = {
            "Single Elimination": [4, 8, 16, 32],
            "Round Robin": [4, 6, 8, 10, 12],
        }
        return game_modes.get(tournament_type, [])
    
    @staticmethod
    def calc_max_rounds(num_players: int, tournament_type: str) -> int:
        """Calculates the maximum number of rounds for a given number of players."""
        if num_players == 1:
            return 1 # to still make one match that is instantly won by the player
        elif tournament_type == "Single Elimination":
            return math.ceil(math.log2(num_players))
        elif tournament_type == "Round Robin":
            return num_players - 1 if num_players % 2 == 0 else num_players
        else:
            raise ValueError(f"Unknown tournament type: {tournament_type}")