from ..models import OnlineTournament, OnlineMatch, OnlineRound, TournamentLobby
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
        lobby.tournament = tournament
        lobby.save()

        TournamentLobbyService.create_next_round(tournament, round_number=1)

    @staticmethod
    def create_next_round(tournament, round_number):
        """ Creates round and matchups for the given round number """
        if round_number == 1:
            # First round: get all participants from the lobby
            participants = tournament.participants.all()
        else:
            # Subsequent rounds: get winners from the previous round
            previous_round = tournament.rounds.filter(round_number=round_number-1).first()
            if previous_round:
                participants = list(previous_round.winners.all())
            else:
                raise ValueError(f"No round found for round number {round_number-1}")
    
        # Get the current round
        current_round = OnlineRound.objects.create(
            round_number=round_number,
            stage=RoundService.get_round_stage(len(participants), tournament.type),
            start_time=timezone.now(), # TODO set real start time, idk if thats correct rn
            room_id=tournament.room_id
        )
        if current_round:
            # Generate matches for the current round
            RoundService.generate_matches(current_round, participants, tournament.type, round_number)
        tournament.rounds.add(current_round)

    @staticmethod
    def record_match_result(match_id, winner_id):
        match = OnlineMatch.objects.get(id=match_id)
        if not match.winner:
            match.winner = User.objects.get(id=winner_id)
        match.completed = True
        match.save()

        # Check if the round is complete
        current_round = match.round_number
        tournament = match.tournament
        if not tournament.matches.filter(round_number=current_round, completed=False).exists():
            TournamentLobbyService.advance_to_next_round(tournament, current_round)

    @staticmethod
    def advance_to_next_round(round_instance: OnlineRound):
        """
        Called when a round has completed all matches.
        We check how many winners exist. If more than 1, create the next round.
        If exactly 1, the tournament is done.
        """
        tournament = round_instance.online_tournaments.first()
        if not tournament:
            raise ValueError("Round is not linked to any OnlineTournament")

        # Grab the winners
        winners = list(round_instance.winners.all())
        if len(winners) <= 1:
            # If there's exactly 1 winner, we have a champion (or 0, handle error).
            tournament.status = 'completed'
            if winners:
                tournament.final_winner = winners[0].username
            tournament.end_time = timezone.now()
            tournament.save()
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
        if tournament_type == "Single Elimination":
            return math.ceil(math.log2(num_players))
        elif tournament_type == "Round Robin":
            return num_players - 1 if num_players % 2 == 0 else num_players
        else:
            raise ValueError(f"Unknown tournament type: {tournament_type}")