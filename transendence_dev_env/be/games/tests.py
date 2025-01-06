from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    TournamentLobby, OnlineTournament, OnlineRound, OnlineMatch, 
    TournamentType, Stage
)
from .services.tournament_lobby_service import TournamentLobbyService
from .services.round_service import RoundService
from .services.tournament_service import TournamentService
import math

class OnlineTournamentTestCase(TransactionTestCase):
    """
    Tests the end-to-end flow of creating and running an online tournament
    (both single-elimination and round-robin) via the TournamentLobbyService.
    """

    def setUp(self):
        # Create test users
        self.user_host = User.objects.create(username="HostPlayer")
        self.user2 = User.objects.create(username="Player2")
        self.user3 = User.objects.create(username="Player3")
        self.user4 = User.objects.create(username="Player4")

        # Create a lobby
        self.lobby = TournamentLobby.objects.create(
            room_id="test123",
            host=self.user_host,
            tournament_type=TournamentType.SINGLE_ELIMINATION,
        )
        # Add guests
        self.lobby.guests.add(self.user2, self.user3, self.user4)

        # Mark everyone as ready
        for p in self.lobby.get_participants():
            self.lobby.set_ready_status(p, True)

    def test_calc_max_rounds(self):
        """test the calc_max_rounds method"""
        self.assertEqual(TournamentLobbyService.calc_max_rounds(4, TournamentType.SINGLE_ELIMINATION), 2)
        self.assertEqual(TournamentLobbyService.calc_max_rounds(3, TournamentType.SINGLE_ELIMINATION), 2)
        self.assertEqual(TournamentLobbyService.calc_max_rounds(1, TournamentType.SINGLE_ELIMINATION), 1, "1 player should have 1 round that is instantly won")
        self.assertEqual(TournamentLobbyService.calc_max_rounds(4, TournamentType.ROUND_ROBIN), 3)

    def test_start_tournament_single_elimination(self):
        """
        Verifies that we can start a single-elimination tournament from the lobby
        and that it creates the correct initial round & matches.
        """
        # Host starts the tournament
        TournamentLobbyService.start_tournament(self.lobby, self.user_host)

        # Fetch the newly created tournament
        tournament = self.lobby.tournament
        self.assertIsNotNone(tournament, "Tournament should have been created.")
        self.assertEqual(tournament.type, TournamentType.SINGLE_ELIMINATION)
        self.assertEqual(tournament.status, "ongoing")

        # Check that participants are correct
        participants = list(tournament.get_participants())
        self.assertEqual(len(participants), 4)
        self.assertIn(self.user_host, participants)
        self.assertIn(self.user2, participants)

        # Check that total_rounds was calculated from the logic (for 4 players -> 2 rounds).
        expected_rounds = math.ceil(math.log2(4))  # which is 2
        self.assertEqual(tournament.total_rounds, expected_rounds)

        # Verify the first round was created (round_number=0 or 1, depending on your logic)
        first_round = tournament.rounds.filter(round_number=1).first()
        self.assertIsNotNone(first_round)
        self.assertEqual(first_round.stage, Stage.SEMI_FINALS)
        self.assertIn(first_round, tournament.rounds.all())
        self.assertTrue(first_round.matches.exists(), "Should have matches in the first round.")

        # Check matches
        matches = first_round.matches.all()
        self.assertEqual(matches.count(), 2, "4 participants => 2 matches in single-elimination first round.")
        # Each match should be 'pending' or 'ongoing'
        for m in matches:
            self.assertIn(m.status, ["pending", "ongoing", "completed", "failed"])

    def test_start_tournament_round_robin(self):
        """
        Verifies starting a Round Robin tournament from the lobby
        with 4 players -> typically 3 total rounds.
        """
        self.lobby.tournament_type = TournamentType.ROUND_ROBIN
        self.lobby.save()

        # Start
        TournamentLobbyService.start_tournament(self.lobby, self.user_host)
        tournament = self.lobby.tournament
        self.assertIsNotNone(tournament, "Round Robin tournament should be created.")

        self.assertEqual(tournament.type, TournamentType.ROUND_ROBIN)
        participants = list(tournament.get_participants())
        self.assertEqual(len(participants), 4)

        # For 4 players, round robin typically has 3 rounds (N-1 if even).
        self.assertEqual(tournament.total_rounds, 3)

        # Check the first round
        first_round = tournament.rounds.filter(round_number=1).first()
        self.assertIsNotNone(first_round)
        matches = first_round.matches.all()
        
        # In a round-robin, the first round with 4 players usually has 2 matches
        self.assertEqual(matches.count(), 2)

    def test_instant_advance_bye(self):
        """
        Tests the scenario where an odd number of players leads to an automatic
        'bye' for the last participant. 
        """
        # Make an odd number of participants by removing one guest
        self.lobby.guests.remove(self.user4)
        # Now we have 3 participants: Host, user2, user3
        for p in self.lobby.get_participants():
            self.lobby.set_ready_status(p, True)

        TournamentLobbyService.start_tournament(self.lobby, self.user_host)
        tournament = self.lobby.tournament
        first_round = tournament.rounds.filter(round_number=1).first()

        # With 3 participants in single-elimination, 
        # we typically create 1 match for two players, 
        # and the third gets an instant advance
        matches = first_round.matches.all()
        self.assertEqual(tournament.participants.count(), 3, "should be 3 participants")
        # self.assertEqual()
        self.assertEqual(matches.count(), 2, "Two matches, because the third player gets the advance in the match itself.")
        self.assertEqual(first_round.matches.filter(status="completed").count(), 1, "One match should be completed.")

        # The 'bye' is represented by a completed match or by skipping
        # If your logic sets that OnlineMatch with winner=player1 immediately,
        # check that:
        maybe_bye_match = matches.first()
        if maybe_bye_match.player2 is None:
            self.assertEqual(maybe_bye_match.status, "completed")
            self.assertIsNotNone(maybe_bye_match.winner, "The single player automatically advanced.")

    def test_advance_rounds_single_elimination(self):
        """
        Tests completing matches in round 1, moving on to round 2 (final),
        then completing the tournament.
        """
        TournamentLobbyService.start_tournament(self.lobby, self.user_host)
        tournament = self.lobby.tournament
        first_round = tournament.rounds.filter(round_number=1).first()

        # Let's pretend we complete all matches in the first round
        for match in first_round.matches.all():
            match.player1_score = 2
            match.player2_score = 1
            match.save()
            match.record_match_result()
        first_round.end_round()
        first_round.save()

        self.assertEqual(tournament.current_round, 1, "we should be in the first round")
        TournamentService.next_round(tournament)

        # We expect the next round to exist with fewer participants (just the winners).
        all_rounds = tournament.rounds.all().order_by("round_number")
        self.assertEqual(all_rounds.count(), 2, "Should have created the second round by now (semi-finals -> finals).")
        second_round = all_rounds.filter(round_number=2).first()
        self.assertTrue(second_round.matches.exists(), "Final round should have a match.")

        # Finish the final match
        for match in second_round.matches.all():
            match.player1_score = 1
            match.player2_score = 0
            match.save()
            match.record_match_result()
        second_round.end_round()
        second_round.save()

        self.assertEqual(tournament.current_round, 2, "we should be in the second round")
        self.assertEqual(second_round.matches.count(), 1, "Final round should have 1 match.")
        self.assertIsNotNone(second_round.winners.first(), "Should have a winner for the final round.")
        # Advance again
        TournamentService.next_round(tournament)

        # The tournament should now be completed
        tournament.refresh_from_db()
        self.assertEqual(tournament.status, "completed")
        self.assertEqual(tournament.final_winner, self.user_host)

    def test_round_robin_multiple_rounds(self):
        """
        Tests that in a round-robin, we can proceed across multiple rounds.
        """
        self.lobby.tournament_type = TournamentType.ROUND_ROBIN
        self.lobby.save()
        TournamentLobbyService.start_tournament(self.lobby, self.user_host)
        tournament = self.lobby.tournament
        first_round = tournament.rounds.filter(round_number=1).first()
        self.assertIsNotNone(first_round)

        # Mark all matches in round 1 completed, but in round-robin,
        # we might not have a single 'winner' for the round. 
        # Instead, each match can set a winner or increment scores. 
        for match in first_round.matches.all():
            match.player1_score = 1
            match.player2_score = 0
            match.save()
            match.record_match_result()
        first_round.end_round()
        first_round.save()
        # We can call something akin to `round_finished`:
        # If your code expects a certain approach for round-robin, do that here.
        TournamentService.next_round(tournament)
        second_round = tournament.rounds.filter(round_number=2).first()
        self.assertIsNotNone(second_round)
        for match in second_round.matches.all():
            match.player1_score = 1
            match.player2_score = 0
            match.save()
            match.record_match_result()
        second_round.end_round()
        second_round.save()
    
        TournamentService.next_round(tournament)
        third_round = tournament.rounds.filter(round_number=3).first()
        self.assertIsNotNone(third_round)
        self.assertIsNotNone(third_round.matches.first().player1, "Should have populated the next round.")
        for match in third_round.matches.all():
            match.player1_score = 1
            match.player2_score = 0
            match.save()
            match.record_match_result()
        third_round.end_round()
        third_round.save()
        TournamentService.next_round(tournament) # called to make the fourth round, if its done, it will set the tournament to completed

    def test_cannot_start_tournament_if_not_all_ready(self):
        # Mark user4 as not ready
        self.lobby.set_ready_status(self.user4, False)

        with self.assertRaises(ValueError):
            TournamentLobbyService.start_tournament(self.lobby, self.user_host)

    def test_only_host_can_start(self):
        with self.assertRaises(PermissionError):
            TournamentLobbyService.start_tournament(self.lobby, self.user2)

    def test_empty_lobby(self):
        """
        If a lobby has no guests and the host is alone, 
        starting a single elimination might yield 1 participant scenario.
        """
        self.lobby.guests.clear()
        # host is the only participant
        self.lobby.set_ready_status(self.user_host, True)
        TournamentLobbyService.start_tournament(self.lobby, self.user_host)

        tournament = self.lobby.tournament
        self.assertEqual(len(list(tournament.get_participants())), 1)
        # Possibly the single participant instantly 'wins' the tournament
        # depending on your logic. 
        self.assertEqual(tournament.status, "ongoing")  # or 'ongoing' if you prefer to mark it done differently.

class RoundServiceUnitTest(TestCase):
    """
    Tests for RoundService's match population logic.
    """
    def setUp(self):
        self.user1 = User.objects.create(username="Player1")
        self.user2 = User.objects.create(username="Player2")
        self.user3 = User.objects.create(username="Player3")
        self.user4 = User.objects.create(username="Player4")

        self.round = OnlineRound.objects.create(
            round_number=1,
            stage=Stage.SEMI_FINALS,
            status='pending',
            start_time=timezone.now(),
            room_id="test123"
        )
        # Pre-create matches with null values for player1 and player2
        self.match1 = OnlineMatch.objects.create(room_id="test123", match_id="match1", status="pending", start_time=timezone.now())
        self.match2 = OnlineMatch.objects.create(room_id="test1234", match_id="match2", status="pending", start_time=timezone.now())

        self.tournament = OnlineTournament.objects.create(
            name="TestTournament",
            type=TournamentType.SINGLE_ELIMINATION,
            status="ongoing",
            room_id="test1234",
            total_rounds=1
        )
        self.tournament.participants.set([self.user1, self.user2, self.user3, self.user4])

    def test_generate_rounds(self):
        rounds = RoundService.generate_rounds(self.tournament)
        self.assertEqual(len(rounds), 1)

    def test_populate_single_elimination_matches_4players(self):
        participants = [self.user1, self.user2, self.user3, self.user4]
        matches = RoundService.create_matches(self.round, len(participants))
        self.round.matches.set(matches)
        RoundService.populate_single_elimination_matches(self.round, participants)

        matches = self.round.matches.all()
        self.assertEqual(matches.count(), 2)

        # Validate the matches were populated correctly
        match1 = matches[0]
        match2 = matches[1]

        self.assertEqual(match1.player1, self.user1)
        self.assertEqual(match1.player2, self.user2)
        self.assertEqual(match2.player1, self.user3)
        self.assertEqual(match2.player2, self.user4)

    def test_populate_single_elimination_matches_odd_number(self):
        participants = [self.user1, self.user2, self.user3]  # 3 participants
        matches = RoundService.create_matches(self.round, len(participants))
        self.round.matches.set(matches)
        RoundService.populate_single_elimination_matches(self.round, participants)
        matches = self.round.matches.all()

        self.assertEqual(matches.count(), 2)

        # Validate the first match is between two players
        match1 = matches[0]
        self.assertEqual(match1.player1, self.user1)
        self.assertEqual(match1.player2, self.user2)
        self.assertEqual(match1.status, "pending")

        # Validate the second match is a "bye"
        match2 = matches[1]
        self.assertEqual(match2.player1, self.user3)
        self.assertIsNone(match2.player2)
        self.assertEqual(match2.status, "completed")
        self.assertEqual(match2.winner, self.user3)

    def test_populate_round_robin_matches(self):
        participants = [self.user1, self.user2, self.user3, self.user4]
        self.round.stage = Stage.ROUND_ROBIN_STAGE
        matches = RoundService.create_matches(self.round, len(participants))
        self.round.matches.set(matches)
        self.assertEqual(self.round.matches.count(), 2)
        
        # Populate round-robin matches for round_index=0
        RoundService.populate_round_robin_matches(self.round, participants, 0)
        matches = self.round.matches.all()
        self.assertIsNotNone(matches)
        self.assertEqual(matches.count(), 2)


        # Validate the matchups for round 1
        match1 = matches[0]
        match2 = matches[1]

        self.assertEqual(match1.player1, self.user1)
        self.assertEqual(match1.player2, self.user4)  # Based on round-robin logic
        self.assertEqual(match2.player1, self.user2)
        self.assertEqual(match2.player2, self.user3)

    def test_new_matchups_invalid_tournament_type(self):
        self.tournament.type = "invalid"
        with self.assertRaises(ValueError):
            TournamentService.new_matchups(self.tournament, list(self.tournament.participants.all()))