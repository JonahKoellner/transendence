from ..models import OnlineTournament, TournamentType, Stage
from .round_service import RoundService
from django.utils import timezone
# from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from random import shuffle
import math
from django.db.models import Q

import logging
logger = logging.getLogger('game_debug')

class TournamentService:
    @staticmethod
    def next_round(tournament: OnlineTournament):
        logger.debug(f"Next round for tournament: {tournament}")
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
            TournamentService.calc_xp(tournament)
            tournament.save()
            return
        elif tournament.current_round == tournament.total_rounds: # round robin tournament finish
            scores = tournament.round_robin_scores
            winner_id = max(scores, key=scores.get)
            tournament.final_winner = tournament.participants.filter(id=winner_id).first()
            tournament.status = 'completed'
            tournament.end_time = timezone.now()
            TournamentService.calc_xp(tournament)
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
        
    @staticmethod
    def calc_xp(tournament):
        """
        Finalize an OnlineTournament by calculating and updating the XP for each participant.
        Then mark the tournament as completed.
        """
        # refresh tournament object
        logger.debug(f"Calculating XP for tournament: {tournament}")

        # ----------------------------------------------------------------
        # 1. Set up base XP constants
        # ----------------------------------------------------------------
        BASE_XP_PARTICIPATION = 10
        BASE_XP_WIN = 50
        ROUND_BONUS_XP = 100
        FINAL_BONUS_XP = 1000

        # List or QuerySet of all participants (User objects)
        participants = tournament.participants.all()
        participant_count = participants.count()

        # ----------------------------------------------------------------
        # 2. Loop over each participant to compute XP
        # ----------------------------------------------------------------
        for user in participants:
            # Start tracking XP for this user
            xp_gain = 0

            # Count wins, total matches, etc.
            total_wins = 0
            total_matches = 0
            rounds_played = 0

            # For convenience, fetch all OnlineRounds in the tournament
            all_rounds = tournament.rounds.all()

            # Count total matches and wins for this user
            for round_instance in all_rounds:
                # All matches in this round
                round_matches = round_instance.matches.all()
                # Filter matches where user participated
                user_matches = round_matches.filter(
                    Q(player1=user) | Q(player2=user)
                )
                total_matches += user_matches.count()

                # Among those matches, count how many this user won
                user_wins = user_matches.filter(winner=user).count()
                total_wins += user_wins

                # If the user played in this round at all, increment rounds_played
                if user_matches.exists():
                    rounds_played += 1

            # ----------------------------------------------------------------
            # 3. Determine multipliers based on tournament type
            # ----------------------------------------------------------------
            type_multiplier = 1.0
            progression_multiplier = 1.0
            performance_multiplier = 1.0
            consistency_bonus = 0.0

            # Single-Elimination
            if tournament.type == TournamentType.SINGLE_ELIMINATION:
                # Example: scale progression up to +70% based on how many rounds 
                # the user participated in vs. total rounds
                total_rounds = all_rounds.count()
                if total_rounds > 0:
                    progression_multiplier = 1 + (rounds_played / total_rounds) * 0.7

                # Optional: add extra multiplier if user won certain stages
                for round_instance in all_rounds:
                    if round_instance.matches.filter(winner=user).exists():
                        stage = round_instance.stage
                        if stage == Stage.QUARTER_FINALS:
                            progression_multiplier += 0.1
                        elif stage == Stage.SEMI_FINALS:
                            progression_multiplier += 0.2
                        elif stage == Stage.GRAND_FINALS:
                            progression_multiplier += 0.5

                type_multiplier = 1.3

            # Round-Robin
            elif tournament.type == TournamentType.ROUND_ROBIN:
                if total_matches > 0:
                    win_ratio = total_wins / total_matches
                    # Consistency bonus
                    if win_ratio > 0.8:
                        consistency_bonus = 200
                    elif win_ratio > 0.5:
                        consistency_bonus = 100

                # Example: rank-based performance multiplier
                rr_rank = TournamentService.get_round_robin_rank(tournament, user)
                if rr_rank == 1:
                    performance_multiplier = 1.5
                elif rr_rank == 2:
                    performance_multiplier = 1.2
                elif rr_rank == 3:
                    performance_multiplier = 1.1

                type_multiplier = 1.1

            # ----------------------------------------------------------------
            # 4. Tournament size multiplier
            # ----------------------------------------------------------------
            size_multiplier = 1 + (participant_count / 100.0)

            # ----------------------------------------------------------------
            # 5. Duration-based XP (optional)
            # ----------------------------------------------------------------
            duration_xp = 0
            if tournament.duration:
                # Example logic with diminishing returns
                if tournament.duration < 3600:
                    duration_xp = tournament.duration * 0.1
                elif tournament.duration < 14400:
                    duration_xp = tournament.duration * 0.05
                else:
                    # Hard cap
                    duration_xp = min(600, 400 + (tournament.duration - 14400) * 0.01)

            # ----------------------------------------------------------------
            # 6. Base XP formula
            # ----------------------------------------------------------------
            xp_gain = (
                BASE_XP_PARTICIPATION +
                (BASE_XP_WIN * total_wins) +
                (ROUND_BONUS_XP * rounds_played) +
                consistency_bonus +
                (FINAL_BONUS_XP if tournament.final_winner == user else 0) +
                duration_xp
            )

            # ----------------------------------------------------------------
            # 7. Apply multipliers
            # ----------------------------------------------------------------
            xp_gain *= type_multiplier
            xp_gain *= progression_multiplier
            xp_gain *= performance_multiplier
            xp_gain *= size_multiplier

            # Convert to integer
            xp_gain = int(xp_gain / 10)

            # ----------------------------------------------------------------
            # 8. Update user's XP
            # ----------------------------------------------------------------
            # Example: if you store XP on user.profile
            user.profile.add_xp(xp_gain)
            logger.debug(f'User {user} gained {xp_gain} XP in tournament {tournament}')

    @staticmethod
    def get_round_robin_rank(tournament, user):
        """
        Example method to determine a user's rank in a Round-Robin tournament.
        You can store and retrieve scores from `tournament.round_robin_scores`,
        or compute them from the matches, depending on your logic.
        """
        # If you're storing scores in tournament.round_robin_scores = {"user_id": score}
        # then you could do something like:
        scores_dict = tournament.round_robin_scores or {}
        # The user's ID as a string
        user_id_str = str(user.id)
        user_score = scores_dict.get(user_id_str, 0)

        # Sort participants by their score in descending order
        sorted_by_score = sorted(
            scores_dict.items(),
            key=lambda item: item[1],
            reverse=True
        )  # [(user_id_str, score), ...]

        rank = 1
        for (uid_str, score) in sorted_by_score:
            if uid_str == user_id_str:
                return rank
            rank += 1

        # If not found, return last place
        return len(sorted_by_score)