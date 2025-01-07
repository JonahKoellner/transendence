# round_service.py
from django.utils import timezone
from django.contrib.auth.models import User
from ..models import (
    OnlineRound,
    OnlineMatch,
    OnlineTournament,
    TournamentType,
    Stage
)
import uuid

import logging
logger = logging.getLogger('game_debug')

def generate_match_id() -> str:
    """
    Generate a short unique match_id for OnlineMatch.
    Adjust as needed if you want a specific format or length.
    """
    return str(uuid.uuid4())[:8]

class RoundService:
    @staticmethod
    def generate_rounds(tournament: OnlineTournament):
        """
        Generate a list of OnlineRound objects based on the total_rounds
        and the tournament_type. Returns a list of OnlineRound objects.
        """
        logger.info(f'generate rounds total_rounds: {tournament.total_rounds}')
        stages = [stage for stage in Stage if stage != Stage.ROUND_ROBIN_STAGE] # dont count round robin stage
        stages.reverse()
        rounds = []
        for i in range(tournament.total_rounds):
            stage = stages[i % len(stages)] if tournament.type == TournamentType.SINGLE_ELIMINATION else Stage.ROUND_ROBIN_STAGE
            round_instance = OnlineRound.objects.create(
                round_number=tournament.total_rounds-i,
                stage=stage,
                room_id=tournament.room_id,
                start_time=timezone.now() # should not be now maybe
            )
            matches = RoundService.create_matches(round_instance, len(tournament.participants.all()))
            round_instance.matches.set(matches)
            rounds.append(round_instance)
        return rounds

    @staticmethod
    def create_matches(round_instance: OnlineRound, player_count):
        if round_instance.stage == Stage.ROUND_ROBIN_STAGE:
            match_count = player_count // 2 #if player_count % 2 == 0 else (player_count // 2) + 1
        else:
            match_count = {
                Stage.PRELIMINARIES: 16,
                Stage.QUALIFIERS: 8,
                Stage.QUARTER_FINALS: 4,
                Stage.SEMI_FINALS: 2,
                Stage.GRAND_FINALS: 1,
            }.get(round_instance.stage, 0)
        matches = []
        for i in range(match_count):
            match = OnlineMatch.objects.create(
                match_id=generate_match_id(),
                room_id=round_instance.room_id,
                status="pending",
                start_time=timezone.now()
            )
            matches.append(match)
        return matches

    @staticmethod
    def populate_single_elimination_matches(round_instance: OnlineRound, participants):
        """
        Populate existing matches in the round_instance with participants in pairs.
        """
        matches = list(round_instance.matches.all())
        if not matches:
            raise ValueError("No matches available to populate in this round.")

        match_index = 0
        for i in range(0, len(participants), 2):
            player1 = participants[i]
            player2 = participants[i + 1] if i + 1 < len(participants) else None
            if match_index >= len(matches):
                raise ValueError(f"Not enough matches to populate all participants.")

            match = matches[match_index]
            match.player1 = player1
            match.player2 = player2
            match.status = "pending" if player2 else "completed"
            match.start_time = timezone.now()
            match.end_time = timezone.now() if not player2 else None
            match.winner = player1 if not player2 else None
            match.save()

            match_index += 1

    @staticmethod
    def populate_round_robin_matches(round_instance: OnlineRound, participants, round_index):
        """
        Populate existing matches in the round_instance using a round-robin schedule.
        """
        matches = list(round_instance.matches.all())
        if not matches:
            raise ValueError("No matches available to populate in this round.")

        num_players = len(participants)
        if num_players < 2:
            raise ValueError("Round-robin requires at least 2 participants.")

        first_player = participants[0]
        rotated_players = participants[1:]
        rotated_players = rotated_players[round_index:] + rotated_players[:round_index]

        match_index = 0
        for i in range(num_players // 2):
            player1 = first_player if i == 0 else rotated_players[i - 1]
            player2 = rotated_players[-i - 1]

            if match_index >= len(matches):
                raise ValueError("Not enough matches to populate all participants.")

            match = matches[match_index]
            match.player1 = player1
            match.player2 = player2
            match.status = "pending"
            match.start_time = timezone.now()
            match.save()

            match_index += 1