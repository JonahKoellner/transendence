# round_service.py
from django.utils import timezone
from django.contrib.auth.models import User
from ..models import (
    OnlineRound,
    OnlineMatch,
    TournamentType,
    Stage
)
import uuid

def generate_match_id() -> str:
    """
    Generate a short unique match_id for OnlineMatch.
    Adjust as needed if you want a specific format or length.
    """
    return str(uuid.uuid4())[:8]

class RoundService:
    @staticmethod
    def generate_matches(round_instance: OnlineRound, participants, tournament_type, round_index=0):
        """
        Create matches in the given `round_instance` (OnlineRound)
        based on the tournament_type and the participant list.
        `participants` should be a list of Django User objects.
        """
        if not participants or len(participants) == 0:
            raise ValueError("Insufficient participants for match.")

        if tournament_type == TournamentType.SINGLE_ELIMINATION:
            RoundService.generate_single_elimination_matches(round_instance, participants)
        elif tournament_type == TournamentType.ROUND_ROBIN:
            RoundService.generate_round_robin_matches(round_instance, participants, round_index)
        else:
            raise ValueError(f"Unknown tournament type: {tournament_type}")

    @staticmethod
    def generate_single_elimination_matches(round_instance: OnlineRound, participants):
        """
        Pairs up participants in sets of two. If there's an odd one out,
        you can either:
          1) Let them automatically advance (a 'bye'),
          2) Assign them an 'AI' or dummy opponent,
          3) Or handle it however your rules dictate.
        """
        for i in range(0, len(participants), 2):
            player1 = participants[i]
            player2 = participants[i + 1] if i + 1 < len(participants) else None

            match = RoundService.create_online_match(player1, player2, round_instance.room_id)
            round_instance.matches.add(match)

        round_instance.save()

    @staticmethod
    def generate_round_robin_matches(round_instance: OnlineRound, participants, round_index):
        """
        Implements a simple round-robin scheduling approach.
        'matchups' is stored in the OnlineRound's JSONField so we don't
        repeat the same pair in subsequent calls.
        """
        num_players = len(participants)
        matchups = round_instance.matchups or {}

        if num_players < 2:
            raise ValueError("Round-robin requires at least 2 participants.")

        # First player is 'fixed', rotate the others (standard round-robin approach).
        first_player = participants[0]
        rotated_players = participants[1:]
        # Perform the rotation based on round_index.
        rotated_players = rotated_players[round_index:] + rotated_players[:round_index]

        matches_created = 0

        # In round-robin, each round typically has num_players//2 matches
        # if num_players is even. If odd, you often use a 'bye'.
        for i in range(num_players // 2):
            player1 = first_player if i == 0 else rotated_players[i - 1]
            player2 = rotated_players[-i - 1]

            # Generate a matchup key to avoid duplicates:
            # sort by ID to keep it consistent.
            id1, id2 = player1.id, player2.id
            if id1 > id2:
                id1, id2 = id2, id1
            matchup_key = f"{id1}:{id2}"

            # Check if this pair already played
            if matchups.get(matchup_key):
                # Already played each other. Move on.
                continue

            match = RoundService.create_online_match(player1, player2, round_instance.room_id)
            matchups[matchup_key] = True
            round_instance.matches.add(match)
            matches_created += 1

        if matches_created == 0:
            raise ValueError("No matches could be created. Possibly all pairs have played or participants list is incorrect.")

        round_instance.matchups = matchups
        round_instance.save()

    @staticmethod
    def create_online_match(player1: User, player2: User, room_id: str):
        """
        Creates a new OnlineMatch with 'pending' status.
        If player2 is None, we treat it as 'AI' or an automatic bye.
        Adjust this logic as desired.
        """
        if not player1:
            raise ValueError("player1 cannot be None in this tournament flow.")
        elif not player2:
            #return None to indicate automatic win.
            return OnlineMatch.objects.create(
                match_id=generate_match_id(),
                room_id=room_id,
                player1=player1,
                player2=None,
                status="completed",
                start_time=timezone.now(),
                end_time=timezone.now(),
                winner=player1,
            )
        else:
            return OnlineMatch.objects.create(
                match_id=generate_match_id(),
                room_id=room_id,
                player1=player1,
                player2=player2,
                status="pending",
                start_time=timezone.now()
            )

    @staticmethod
    def get_round_stage(participant_count, tournament_type):
        """
        Returns the appropriate Stage for a given participant_count
        in the context of SINGLE_ELIMINATION or ROUND_ROBIN.
        """
        if tournament_type == TournamentType.ROUND_ROBIN:
            return Stage.ROUND_ROBIN_STAGE
        elif tournament_type == TournamentType.SINGLE_ELIMINATION:
            if participant_count <= 2:
                return Stage.GRAND_FINALS
            elif participant_count <= 4:
                return Stage.SEMI_FINALS
            elif participant_count <= 8:
                return Stage.QUARTER_FINALS
            elif participant_count <= 16:
                return Stage.QUALIFIERS
            elif participant_count <= 32:
                return Stage.PRELIMINARIES
            else:
                return Stage.PRELIMINARIES
        else:
            raise ValueError(f"Unknown tournament type: {tournament_type}")