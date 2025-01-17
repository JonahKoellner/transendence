from ..models import OnlineTournament, OnlineMatch, OnlineRound, TournamentLobby, MatchOutcome
from .tournament_service import TournamentService
from .round_service import RoundService
from django.utils import timezone
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from random import shuffle
import math

import logging
logger = logging.getLogger('game_debug')

class TournamentLobbyService:
    @staticmethod
    def start_tournament(lobby: TournamentLobby, user):
        logger.debug(f"Starting tournament {lobby.room_id} (tournamentlobbyservice)")
        if user != lobby.host:
            raise PermissionError("Only the host can start the tournament.")
        if not lobby.all_ready():
            raise ValueError("Not all players are ready.")
        tournament = OnlineTournament.objects.create(
            name=f"Tournament {lobby.room_id}",
            type=lobby.tournament_type,
            status="ongoing",
            room_id=lobby.room_id,
        )
        tournament.participants.set(list(lobby.guests.all()) + [lobby.host])
        tournament.total_rounds = TournamentLobbyService.calc_max_rounds(len(tournament.participants.all()), lobby.tournament_type)
        logger.debug(f'Total rounds {tournament.total_rounds}')
        tournament.save()
        rounds = RoundService.generate_rounds(tournament) # generates rounds and matches
        tournament.rounds.set(rounds)
        tournament.save()
        if lobby.tournament_type == "Single Elimination":
            TournamentService.new_matchups(tournament, tournament.participants.all())
        tournament.save()
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
    def adjust_max_player_count(lobby: TournamentLobby):
        """Ensures max_player_count is valid based on the game mode and player count."""
        player_count = lobby.guests.count() + 1  # Including the host

        # Define allowed player counts for each tournament type
        game_modes = {
            "Single Elimination": [4, 8, 16, 32],
            "Round Robin": [4, 6, 8, 10, 12],
        }

        # Get allowed player counts for the given tournament type
        allowed_counts = game_modes.get(lobby.tournament_type, [])

        # Determine the smallest valid max_player_count >= current player count
        valid_counts = [count for count in allowed_counts if count >= player_count]
        if valid_counts:
            lobby.max_player_count = valid_counts[0]

        lobby.save()

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