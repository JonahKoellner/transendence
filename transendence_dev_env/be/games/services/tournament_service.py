from ..models import OnlineTournament, TournamentType
from .round_service import RoundService
from django.utils import timezone
# from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from random import shuffle
import math

import logging
logger = logging.getLogger('game_debug')

class TournamentService:
    @staticmethod
    def next_round(tournament: OnlineTournament):
        logger.info(f"Next round for tournament: {tournament}")
        round = tournament.rounds.filter(round_number=tournament.current_round).first()
        if not round:
            raise ValueError("No round found for the current round number.")
        if round.status != 'completed':
            raise ValueError("Current round not completed.")
        winners = list(round.winners.all())

        if len(winners) == 0:
            raise ValueError("No winners found for the current round.")
        elif len(winners) == 1: # single elimination win
            tournament.final_winner = winners[0]
            tournament.status = 'completed'
            tournament.end_time = timezone.now()
            tournament.save()
            return
        elif tournament.current_round == tournament.total_rounds: # round robin tournament finish
            scores = tournament.round_robin_scores
            winner_id = max(scores, key=scores.get)
            tournament.final_winner = tournament.participants.filter(id=winner_id).first()
            tournament.status = 'completed'
            tournament.end_time = timezone.now()
            tournament.save()
            return
        else:
            tournament.current_round += 1
            tournament.save()
            if tournament.type == TournamentType.SINGLE_ELIMINATION:
                new_participants = winners
                TournamentService.new_matchups(tournament, new_participants)

    @staticmethod
    def new_matchups(tournament: OnlineTournament, winners_last_round):
        """
        Populate matches in the given `round_instance` (OnlineRound)
        based on the tournament_type and the participant list.
        `participants` should be a list of Django User objects.
        """
        round_instance = tournament.rounds.filter(round_number=tournament.current_round).first()
        participants_set = set(tournament.participants.all())
        filtered_winners = [winner for winner in winners_last_round if winner in participants_set]
        
        
        if not filtered_winners or len(filtered_winners) == 0:
            raise ValueError("Insufficient participants for match.")
        if not round_instance:
            raise ValueError(f"No round found for the current round number. {tournament.current_round}")

        if tournament.type == TournamentType.SINGLE_ELIMINATION:
            RoundService.populate_single_elimination_matches(round_instance, filtered_winners)
        else:
            raise ValueError(f"Unknown tournament type: {tournament.type}")