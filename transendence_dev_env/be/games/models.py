from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.models import User

class TournamentType(models.TextChoices):
    SINGLE_ELIMINATION = 'Single Elimination'
    ROUND_ROBIN = 'Round Robin'

class Stage(models.TextChoices):
    PRELIMINARIES = 'Preliminaries'
    QUALIFIERS = 'Qualifiers'
    QUARTER_FINALS = 'Quarter Finals'
    SEMI_FINALS = 'Semi Finals'
    GRAND_FINALS = 'Grand Finals'
    ROUND_ROBIN_STAGE = 'Round Robin Stage'

class MatchOutcome(models.TextChoices):
    FINISHED = 'Finished'
    TIE = 'Tie'

class TiebreakerMethod(models.TextChoices):
    TOTAL_POINTS = 'Total Points'
    MOST_WINS = 'Most Wins'
    RANDOM_SELECTION = 'Random Selection'

class Match(models.Model):
    player1 = models.CharField(max_length=255)
    player1_type = models.CharField(max_length=50)
    player2 = models.CharField(max_length=255)
    player2_type = models.CharField(max_length=50)
    winner = models.CharField(max_length=255, blank=True, null=True)
    winner_type = models.CharField(max_length=50, blank=True, null=True)
    outcome = models.CharField(max_length=50, choices=MatchOutcome.choices, blank=True, null=True)
    player1_score = models.IntegerField(blank=True, null=True)
    player2_score = models.IntegerField(blank=True, null=True)
    tie_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(blank=True, null=True)
    duration = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=50, choices=[
        ('pending', 'Pending'), ('ongoing', 'Ongoing'), ('completed', 'Completed'), ('failed', 'Failed')
    ])

class Round(models.Model):
    round_number = models.IntegerField()
    matches = models.ManyToManyField(Match, related_name='rounds')
    stage = models.CharField(max_length=50, choices=Stage.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(blank=True, null=True)
    duration = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=50, choices=[
        ('pending', 'Pending'), ('ongoing', 'Ongoing'), ('completed', 'Completed')
    ])

class Tournament(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, choices=TournamentType.choices)
    rounds = models.ManyToManyField(Round, related_name='tournaments')
    final_winner = models.CharField(max_length=255, blank=True, null=True)
    final_winner_type = models.CharField(max_length=50, blank=True, null=True)
    all_participants = models.JSONField(blank=True, null=True)
    players_only = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(blank=True, null=True)
    duration = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=50, choices=[
        ('pending', 'Pending'), ('ongoing', 'Ongoing'), ('completed', 'Completed')
    ])
    winner_determination_method_message = models.TextField(blank=True, null=True)
    tiebreaker_method = models.CharField(max_length=50, choices=TiebreakerMethod.choices, blank=True, null=True)
    winner_tie_resolved = models.BooleanField(default=False)
    host = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='hosted_tournaments'
    )
    
class Lobby(models.Model):
    room_id = models.CharField(max_length=10, unique=True)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_lobbies")
    guest = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="joined_lobbies")
    is_host_ready = models.BooleanField(default=False)
    is_guest_ready = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    max_rounds = models.IntegerField(default=3)  # New field for max rounds
    round_score_limit = models.IntegerField(default=3)  # New field for round score limit

    def is_full(self):
        return self.guest is not None

    def all_ready(self):
        return self.is_host_ready and self.is_guest_ready

    def get_host_name(self):
        return self.host.username if self.host else "Waiting for host"

    def get_guest_name(self):
        return self.guest.username if self.guest else "Waiting for guest"

    def set_ready_status(self, user, is_ready):
        """ Set the ready status for the host or guest based on the user. """
        if user == self.host:
            self.is_host_ready = is_ready
        elif user == self.guest:
            self.is_guest_ready = is_ready
        self.save()

    def get_lobby_state(self):
        return {
            "is_host_ready": self.is_host_ready,
            "is_guest_ready": self.is_guest_ready,
            "all_ready": self.all_ready(),
            "host_name": str(self.host.username) if self.host else None,
            "guest_name": str(self.guest.username) if self.guest else None,
            "is_full": self.is_full(),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "max_rounds": self.max_rounds,
            "round_score_limit": self.round_score_limit,
            "room_id": self.room_id
            # Avoid including entire model instances
        }
    def has_guest_joined(self):
        """Returns True if the guest has joined the lobby."""
        return self.guest is not None

class Game(models.Model):
    # Game Modes
    PVE = 'pve'
    LOCAL_PVP = 'local_pvp'
    ONLINE_PVP = 'online_pvp'


    GAME_MODES = [
        (PVE, 'Player vs AI'),
        (LOCAL_PVP, 'Local Player vs Local Player'),
        (ONLINE_PVP, 'Online Player vs Online Player')
    ]
    
    # Game States
    STARTED = 'started'
    RUNNING = 'running'
    FINISHED = 'finished'
    CANCELED_BY_HOST = 'canceled_by_host'
    CANCELED_BY_GUEST = 'canceled_by_guest'
    STATES = [
        (STARTED, 'Started'),
        (RUNNING, 'Running'),
        (FINISHED, 'Finished'),
        (CANCELED_BY_HOST, 'Canceled by Host'),
        (CANCELED_BY_GUEST, 'Canceled by Guest')
    ]
    lobby = models.ForeignKey(Lobby, on_delete=models.CASCADE, related_name='games', null=True, blank=True, default=None)
    # Core Fields
    player1 = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='games_as_player1'
    )
    player2 = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='games_as_player2', 
        blank=True, null=True  # Allow null to represent AI
    )
    
    player2_name_pvp_local = models.CharField(max_length=100, blank=True, null=True)

    game_mode = models.CharField(max_length=20, choices=GAME_MODES)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.FloatField(null=True, blank=True)  # Total duration in seconds
    
    # Detailed Logging
    moves_log = models.JSONField(blank=True, null=True)  # Log of moves (timestamps, player actions)
    rounds = models.JSONField(blank=True, null=True)     # Round details (scores, times, round winner)
    status = models.CharField(max_length=20, choices=STATES, default=STARTED)
    # Scores and Results
    score_player1 = models.IntegerField(default=0)
    score_player2 = models.IntegerField(default=0)
    
    
    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        related_name='games_won', 
        null=True, blank=True
    )
    is_completed = models.BooleanField(default=False)

    def is_against_ai(self):
        """ Check if the game is a PvE game against an AI. """
        return self.player2 is None

    def __str__(self):
        return f"{self.player1.username} vs {self.player2_name_pvp_local or self.player2 or 'AI'} - {self.game_mode}"
    
    class Meta:
        ordering = ['-start_time']
