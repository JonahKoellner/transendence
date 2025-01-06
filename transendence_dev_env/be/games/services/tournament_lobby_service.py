from ..models import OnlineTournament, OnlineMatch, OnlineRound, TournamentLobby, MatchOutcome
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
        print(lobby.tournament_type)
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
        lobby.tournament = tournament
        lobby.save()

        RoundService.populate_matchups(tournament)

    @staticmethod
    def record_match_result(match_id):
        match = OnlineMatch.objects.get(id=match_id)
        if not match.winner:
            if not match.player1_score or not match.player2_score:
                raise ValueError("Match result is incomplete.")
            else:
                match.winner = match.player1 if match.player1_score > match.player2_score else match.player2
                match.status = 'completed'
                match.end_time = timezone.now()
                match.outcome = MatchOutcome.FINISHED
                match.save()

    @staticmethod
    def advance_to_next_round(tournament: OnlineTournament):
        """
        Called when a round has completed all matches.
        We check how many winners exist. If more than 1, create the next round.
        If exactly 1, the tournament is done.
        """
        round_instance = tournament.rounds.filter(round_number=tournament.current_round).first()
        if not round_instance:
            raise ValueError("No round found for the current round number.")

        # Grab the winners
        winners = list(round_instance.winners.all())
        if len(winners) == 1: # tournament done
            tournament.status = 'completed'
            if winners:
                tournament.final_winner = winners[0]
            tournament.end_time = timezone.now()
            tournament.save()
        elif len(winners) == 0:
            raise ValueError("No winners found for the current round.")
        else:
            # We have multiple winners -> create next round
            next_round_number = round_instance.round_number + 1
            TournamentLobbyService.create_next_round(tournament, next_round_number)

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
        if valid_counts and lobby.max_player_count not in valid_counts: #TODO decide whether the host should even be able to decide on tournament size
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