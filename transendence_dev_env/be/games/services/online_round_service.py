from ..models import Round, Match, TournamentType
from django.utils import timezone

class RoundService:
    @staticmethod
    def generate_matches(round_instance: Round, participants, tournament_type, round_index=0):
        if tournament_type == TournamentType.SINGLE_ELIMINATION:
            RoundService.generate_single_elimination_matches(round_instance, participants)
        elif tournament_type == TournamentType.ROUND_ROBIN:
            RoundService.generate_round_robin_matches(round_instance, participants, round_index)
        else:
            raise ValueError(f"Unknown tournament type: {tournament_type}")

    @staticmethod
    def generate_single_elimination_matches(round_instance: Round, participants):
        for i in range(0, len(participants), 2):
            player1 = participants[i]
            player2 = participants[i+1] if i+1 < len(participants) else None
            match = RoundService.create_match(player1, player2)
            round_instance.matches.add(match)
        round_instance.save()

    @staticmethod
    def generate_round_robin_matches(round_instance: Round, participants, round_index):
        num_players = len(participants)
        matchups = round_instance.matchups or {}

        first_player = participants[0]
        rotated_players = participants[1:]
        rotated_players = rotated_players[round_index:] + rotated_players[:round_index]
        matches_created = 0

        for i in range(num_players // 2):
            player1 = first_player if i == 0 else rotated_players[i - 1]
            player2 = rotated_players[-i - 1]
            matchup_key = f"{player1.id}:{player2.id}" if player1.id < player2.id else f"{player2.id}:{player1.id}"

            if matchups.get(matchup_key):
                continue
            match = RoundService.create_match(player1, player2)
            matchups[matchup_key] = True
            round_instance.matches.add(match)
            matches_created += 1

        if matches_created == 0:
            raise ValueError("No matches could be created. Check matchups or participant list.")

        round_instance.matchups = matchups
        round_instance.save()

    @staticmethod
    def create_match(player1, player2):
        return Match.objects.create(
            player1=player1.username if player1 else "AI",
            player1_type="Human" if player1 else "AI",
            player2=player2.username if player2 else "AI",
            player2_type="Human" if player2 else "AI",
            status="pending",
            start_time=timezone.now()
        )