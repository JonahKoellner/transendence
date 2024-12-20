from ..models import OnlineTournament, Match, OnlineRound
from .round_service import RoundService
from django.utils import timezone
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from random import shuffle

class TournamentLobbyService:
    @staticmethod
    async def start_tournament(lobby, user):
        if user != lobby.host:
            raise PermissionError("Only the host can start the tournament.")
        if not await database_sync_to_async(lobby.all_ready)():
            raise ValueError("Not all players are ready.")

        tournament = await database_sync_to_async(OnlineTournament.objects.create)(
            name=f"Tournament {lobby.room_id}",
            type=lobby.tournament_type,
            host=lobby.host,
            status="ongoing"
        )
        await database_sync_to_async(tournament.participants.set)(lobby.guests.all())
        lobby.tournament = tournament
        await database_sync_to_async(lobby.save)()

        await TournamentLobbyService.create_next_round(tournament, round_number=0)

    @staticmethod
    @database_sync_to_async
    def create_next_round(tournament, round_number):
        """ Creates round and matchups for the given round number """
        if round_number == 0:
            # First round: get all participants from the lobby
            participants = list([tournament.host] + tournament.participants.select_related('user').all())
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
        )
        if current_round:
            # Generate matches for the current round
            RoundService.generate_matches(current_round, participants, tournament.type, round_number)
        tournament.rounds.add(current_round)

    @staticmethod
    @database_sync_to_async
    def record_match_result(match_id, winner_id):
        match = Match.objects.get(id=match_id)
        match.winner = User.objects.get(id=winner_id)
        match.completed = True
        match.save()

        # Check if the round is complete
        current_round = match.round_number
        tournament = match.tournament
        if not tournament.matches.filter(round_number=current_round, completed=False).exists():
            TournamentLobbyService.advance_to_next_round(tournament, current_round)

    @staticmethod
    def advance_to_next_round(tournament, current_round):
        next_round = current_round + 1
        winners = tournament.matches.filter(round_number=current_round).values_list("winner", flat=True)
        if len(winners) > 1:
            TournamentLobbyService.create_round(tournament, round_number=next_round)
        else:
            tournament.status = "completed"
            tournament.winner = User.objects.get(id=winners[0])
            tournament.end_time = timezone.now()
            tournament.save()

    @staticmethod
    @database_sync_to_async
    def handle_user_disconnect(user, lobby):
        if user == lobby.host:
            lobby.delete()
        elif user in lobby.guests.all():
            lobby.guests.remove(user)
        lobby.save()

    @staticmethod
    @database_sync_to_async
    def get_lobby_state(lobby):
        return lobby.get_lobby_state()