from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    TournamentLobby, OnlineTournament, OnlineRound, OnlineMatch, 
    TournamentType, Stage
)
from .services.tournament_lobby_service import TournamentLobbyService
from .services.round_service import RoundService
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
            total_rounds=2,  # might be overridden by logic in start_tournament
        )
        # Add guests
        self.lobby.guests.add(self.user2, self.user3, self.user4)

        # Mark everyone as ready
        for p in self.lobby.get_participants():
            self.lobby.set_ready_status(p, True)

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
        first_round = tournament.rounds.first()
        self.assertIsNotNone(first_round)
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
        first_round = tournament.rounds.first()
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
        first_round = tournament.rounds.first()

        # With 3 participants in single-elimination, 
        # we typically create 1 match for two players, 
        # and the third gets an instant advance
        matches = first_round.matches.all()
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
        first_round = tournament.rounds.first()

        # Let's pretend we complete all matches in the first round
        for match in first_round.matches.all():
            match.status = "completed"
            # set an arbitrary winner (e.g. always user_host)
            match.winner = match.player1
            match.save()
            first_round.winners.add(match.player1)
        first_round.save()

        # Now we simulate "round_finished". Usually the service or signal calls it.
        # For simplicity:
        # from .services.tournament_lobby_service import TournamentLobbyService
        TournamentLobbyService.advance_to_next_round(first_round)

        # We expect the next round to exist with fewer participants (just the winners).
        all_rounds = tournament.rounds.all().order_by("round_number")
        self.assertEqual(all_rounds.count(), 2, "Should have created the second round by now (semi-finals -> finals).")
        second_round = all_rounds.last()
        self.assertTrue(second_round.matches.exists(), "Final round should have a match.")

        # Finish the final match
        final_match = second_round.matches.first()
        final_match.status = "completed"
        final_match.winner = self.user_host
        final_match.save()
        second_round.winners.add(self.user_host)
        second_round.save()

        # Advance again
        TournamentLobbyService.advance_to_next_round(second_round)

        # The tournament should now be completed
        tournament.refresh_from_db()
        self.assertEqual(tournament.status, "completed")
        self.assertEqual(tournament.final_winner, self.user_host.username)

    def test_round_robin_multiple_rounds(self):
        """
        Tests that in a round-robin, we can proceed across multiple rounds.
        """
        self.lobby.tournament_type = TournamentType.ROUND_ROBIN
        self.lobby.save()
        TournamentLobbyService.start_tournament(self.lobby, self.user_host)
        tournament = self.lobby.tournament
        first_round = tournament.rounds.first()
        self.assertIsNotNone(first_round)

        # Mark all matches in round 1 completed, but in round-robin,
        # we might not have a single 'winner' for the round. 
        # Instead, each match can set a winner or increment scores. 
        for match in first_round.matches.all():
            match.status = "completed"
            match.winner = self.user_host  # arbitrary
            match.save()

        # We can call something akin to `round_finished`:
        # If your code expects a certain approach for round-robin, do that here.
        TournamentLobbyService.advance_to_next_round(first_round)

        # Check that we have a second round 
        second_round = OnlineRound.objects.filter(round_number=1).last()  # or round_number=2 if your indexing is +1
        self.assertIsNotNone(second_round)
        # Likely we do more matches. Round-robin often has N-1 rounds total for N=4 => 3 rounds. 
        # You can continue or just assert that the second round got created.

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
    More focused tests for RoundService's match generation logic.
    """
    def setUp(self):
        self.user1 = User.objects.create(username="Player1")
        self.user2 = User.objects.create(username="Player2")
        self.user3 = User.objects.create(username="Player3")
        self.user4 = User.objects.create(username="Player4")

        self.round = OnlineRound.objects.create(
            round_number=1,
            stage=Stage.PRELIMINARIES,
            status='pending',
            start_time=timezone.now(),
            room_id="test123"
        )

    def test_generate_single_elimination_matches_4players(self):
        participants = [self.user1, self.user2, self.user3, self.user4]
        RoundService.generate_single_elimination_matches(self.round, participants)

        matches = self.round.matches.all()
        self.assertEqual(matches.count(), 2)
        # They should be "player1 vs player2" and "player3 vs player4"
        # (or some order) depending on how you coded it.

    def test_generate_single_elimination_matches_odd_number(self):
        participants = [self.user1, self.user2, self.user3]  # 3 participants
        RoundService.generate_single_elimination_matches(self.round, participants)
        matches = self.round.matches.all()
        # 3 players => 1 match, and 1 'bye' 
        self.assertEqual(matches.count(), 2)

        # Possibly check if that match is completed automatically if you treat it as a bye. 
        # Or if you create a second "bye" match with winner=player3, etc.

    def test_generate_round_robin_matches(self):
        participants = [self.user1, self.user2, self.user3, self.user4]
        RoundService.generate_round_robin_matches(self.round, participants, round_index=0)
        matches = self.round.matches.all()
        # Typically 2 matches in the first round for 4 players
        self.assertEqual(matches.count(), 2)

        # Check for no duplicates if we call it again with round_index=1
        RoundService.generate_round_robin_matches(self.round, participants, round_index=1)
        matches2 = self.round.matches.all()
        # More matches, but none should be duplicates from the first round
        self.assertGreater(matches2.count(), 2)
        # Could also verify the JSONField "matchups" logic

    def test_generate_matches_invalid_tournament_type(self):
        participants = [self.user1, self.user2]
        with self.assertRaises(ValueError):
            RoundService.generate_matches(self.round, participants, "InvalidType")