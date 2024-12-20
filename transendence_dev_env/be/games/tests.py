from django.test import TransactionTestCase, TestCase
from django.contrib.auth.models import User
from .models import OnlineTournament, Participant, TournamentType, TournamentLobby, OnlineRound
from .services.tournament_lobby_service import TournamentLobbyService
from .services.round_service import RoundService
from django.utils import timezone
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async

class TournamentLobbyServiceTest(TransactionTestCase):
    
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

        # Create a lobby instance
        self.lobby = TournamentLobby.objects.create(
            room_id="test_room",
            host=self.user1,
            tournament_type=TournamentType.SINGLE_ELIMINATION
        )
        self.lobby.guests.add(self.user2, self.user3, self.user4)
        for player in self.lobby.get_participants():
            self.lobby.set_ready_status(player, True)

    
    def test_start_tournament(self):
        # Start the tournament
        TournamentLobbyService.start_tournament(self.lobby, self.user1)

        # Fetch the tournament
        tournament = OnlineTournament.objects.get(tournament_type=TournamentType.SINGLE_ELIMINATION)

        # Assert the correct number of participants
        participants = tournament.get_participants()
        self.assertEqual(len(participants), 4)

        # Assert the correct number of rounds
        rounds = list(tournament.rounds.all())
        self.assertEqual(len(rounds), 1)

        # Assert the correct number of matches
        matches = list(rounds[0].matches.all())
        self.assertEqual(len(matches), 2)

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
        print(match1.player1, match1.player2) # TODO find out why p1+p4 and p2+p3 gets matched.
        print(match2.player1, match2.player2)
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
            RoundService.generate_matches(self.round, [], TournamentType.SINGLE_ELIMINATION)