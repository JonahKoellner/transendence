from django.test import TestCase
from django.contrib.auth.models import User
from .models import OnlineRound, Match, Participant, TournamentType
from .services.online_round_service import RoundService
from django.utils import timezone

class RoundServiceTest(TestCase):
    def setUp(self):
        # Create test users
        self.user1 = User.objects.create(username="Player1")
        self.user2 = User.objects.create(username="Player2")
        self.user3 = User.objects.create(username="Player3")
        self.user4 = User.objects.create(username="Player4")

        # Create participants
        self.participant1 = Participant.objects.create(user=self.user1)
        self.participant2 = Participant.objects.create(user=self.user2)
        self.participant3 = Participant.objects.create(user=self.user3)
        self.participant4 = Participant.objects.create(user=self.user4)

        # Create a round instance
        self.round = OnlineRound.objects.create(
            round_number=1,
            stage='PRELIMINARIES',
            status='pending',
            start_time=timezone.now()
        )

        # Participants list
        self.participants = [
            self.participant1,
            self.participant2,
            self.participant3,
            self.participant4
        ]
        
    def test_generate_single_elimination_matches(self):
        # Generate matches
        RoundService.generate_single_elimination_matches(self.round, self.participants)

        # Fetch matches
        matches = self.round.matches.all()

        # Assert the correct number of matches
        self.assertEqual(matches.count(), 2)

        # Assert the correct matchups
        match1 = matches[0]
        match2 = matches[1]
        self.assertEqual(match1.player1, "Player1")
        self.assertEqual(match1.player2, "Player2")
        self.assertEqual(match2.player1, "Player3")
        self.assertEqual(match2.player2, "Player4")
        
    def test_generate_round_robin_matches(self):
        # Generate matches for the first round
        RoundService.generate_round_robin_matches(self.round, self.participants, round_index=0)

        # Fetch matches
        matches = self.round.matches.all()

        # Assert the correct number of matches
        self.assertEqual(matches.count(), 2)

        # Assert the correct matchups
        match1 = matches[0]
        match2 = matches[1]
        self.assertEqual(match1.player1, "Player1")
        self.assertEqual(match1.player2, "Player2")
        self.assertEqual(match2.player1, "Player1")
        self.assertEqual(match2.player2, "Player3")
        
    def test_generate_round_robin_matches(self):
        # Generate matches for the first round
        RoundService.generate_round_robin_matches(self.round, self.participants, round_index=0)

        # Fetch matches
        matches = self.round.matches.all()

        # Assert the correct number of matches
        self.assertEqual(matches.count(), 2)

        # Assert the correct matchups
        match1 = matches[0]
        match2 = matches[1]
        self.assertEqual(match1.player1, "Player1")
        self.assertEqual(match1.player2, "Player2")
        self.assertEqual(match2.player1, "Player1")
        self.assertEqual(match2.player2, "Player3")

	# TODO when only one player in a match the player wins instantly
    def test_single_elimination_with_insufficient_participants(self):
        participants = [self.participant1]  # Only one participant

        # matches should be generated fine, in the match logic there hsould be a check for only one player
        RoundService.generate_single_elimination_matches(self.round, participants)
        
    def test_round_robin_prevent_duplicate_matchups(self):
        # Simulate a second round with the same participants
        RoundService.generate_round_robin_matches(self.round, self.participants, round_index=0)
        RoundService.generate_round_robin_matches(self.round, self.participants, round_index=1)

        # Fetch matches
        matches = self.round.matches.all()

        # Assert no duplicates
        matchup_keys = {f"{m.player1}:{m.player2}" for m in matches}
        self.assertEqual(len(matchup_keys), matches.count())
        
    def test_invalid_tournament_type(self):
        with self.assertRaises(ValueError):
            RoundService.generate_matches(self.round, self.participants, "INVALID_TYPE")
            
    def test_empty_participants(self):
        with self.assertRaises(ValueError):
            RoundService.generate_single_elimination_matches(self.round, [])