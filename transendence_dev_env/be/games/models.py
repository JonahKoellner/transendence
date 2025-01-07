from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator

import logging
logger = logging.getLogger('game_debug')

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

class BaseMatch(models.Model):
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
    class Meta:
        abstract = True

class Match(BaseMatch):
    player1 = models.CharField(max_length=255)
    player1_type = models.CharField(max_length=50)
    player2 = models.CharField(max_length=255)
    player2_type = models.CharField(max_length=50)
    winner = models.CharField(max_length=255, blank=True, null=True)
    winner_type = models.CharField(max_length=50, blank=True, null=True)

class OnlineMatch(BaseMatch):
    room_id = models.CharField(max_length=10) # RoomId from the tournament lobby
    match_id = models.CharField(max_length=10, unique=True)
    player1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_player1', blank=True, null=True)
    player2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_player2', blank=True, null=True)
    winner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_won', blank=True, null=True)

    def record_match_result(self):
        if self.winner == None:
            if self.player1_score is None or self.player2_score is None:
                raise ValueError("Match result is incomplete.")
            else:
                self.winner = self.player1 if self.player1_score > self.player2_score else self.player2
                self.status = 'completed'
                self.end_time = timezone.now()
                self.outcome = MatchOutcome.FINISHED
                self.save()

class BaseRound(models.Model):
    round_number = models.IntegerField()
    stage = models.CharField(max_length=50, choices=Stage.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(blank=True, null=True)
    duration = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=50, choices=[
        ('pending', 'Pending'), ('ongoing', 'Ongoing'), ('completed', 'Completed')
    ])
    class Meta:
        abstract = True

class Round(BaseRound):
    matches = models.ManyToManyField(Match, related_name='rounds')

class OnlineRound(BaseRound):
    room_id = models.CharField(max_length=10) # RoomId from the tournament lobby
    matches = models.ManyToManyField(OnlineMatch, related_name='online_rounds')
    winners = models.ManyToManyField(User, related_name='rounds_won', blank=True)
    #TODO add start_time nullable and blank to override the start time from baseround because we dont know the start time upon creation. alternative: just update start time
    
    def end_round(self):
        for match in self.matches.all():
            if match.winner == None:
                raise ValueError("Match result is incomplete.")
            self.winners.add(match.winner)
        self.end_time = timezone.now()
        self.duration = (self.end_time - self.start_time).total_seconds()
        self.status = 'completed'
        self.save()

class BaseTournament(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, choices=TournamentType.choices)
    rounds = models.ManyToManyField(Round, related_name='tournaments')
    created_at = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(blank=True, null=True)
    duration = models.IntegerField(blank=True, null=True)
    status = models.CharField(max_length=50, choices=[
        ('pending', 'Pending'), ('ongoing', 'Ongoing'), ('completed', 'Completed')
    ])
    winner_determination_method_message = models.TextField(blank=True, null=True)
    tiebreaker_method = models.CharField(max_length=50, choices=TiebreakerMethod.choices, blank=True, null=True)
    winner_tie_resolved = models.BooleanField(default=False)
    class Meta:
        abstract = True

class OnlineTournament(BaseTournament):
    room_id = models.CharField(max_length=10, unique=True) # RoomId from the tournament lobby
    participants = models.ManyToManyField(User, related_name='online_tournaments')
    final_winner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='online_tournaments_won', blank=True, null=True)
    rounds = models.ManyToManyField(OnlineRound, related_name='online_tournaments')
    current_round = models.IntegerField(default=1)
    total_rounds = models.IntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(5)])
    round_robin_scores = models.JSONField(default=dict) # store user with score
    participants_ready_states = models.JSONField(default=dict) # {user_id: is_ready}
    def get_participants(self):
        return list(self.participants.all())

    def delete(self, *args, **kwargs):
        logger.error(f"TournamentLobby with room_id {self.room_id} is being deleted.")
        super().delete(*args, **kwargs)

    def get_tournament_state(self):
        rounds_data = []
        for round_instance in self.rounds.all():
            rounds_data.append({
                "round_number": round_instance.round_number,
                "stage": round_instance.stage,
                "matches": [
                    {
                        "match_id": match.match_id,
                        "player1": match.player1.username if match.player1 else None,
                        "player2": match.player2.username if match.player2 else None,
                        "player1_score": match.player1_score if match.player1_score is not None else None,
                        "player2_score": match.player2_score if match.player2_score is not None else None,
                        "winner": match.winner.username if match.winner else None,
                        "status": match.status,
                        "start_time": match.start_time.isoformat() if match.start_time else None,
                        "end_time": match.end_time.isoformat() if match.end_time else None,
                    }
                    for match in round_instance.matches.all()
                ],
                "winners": [winner.username for winner in round_instance.winners.all()],
                "status": round_instance.status,
                "start_time": round_instance.start_time.isoformat() if round_instance.start_time else None,
                "end_time": round_instance.end_time.isoformat() if round_instance.end_time else None,
            })

        participants_data = [
            {
                "username": participant.username,
                "id": participant.id,
                "is_ready": self.participants_ready_states.get(str(participant.id), False)
            }
            for participant in self.participants.all()
        ]

        tournament_state = {
            "room_id": self.room_id,
            "name": self.name,
            "tournament_type": self.type,
            "status": self.status,
            "rounds": rounds_data,
            "participants": participants_data,
            "round_robin_scores": self.round_robin_scores,
            "final_winner": self.final_winner.username if self.final_winner else None,
        }
        return tournament_state

class Tournament(BaseTournament):
    start_time = models.DateTimeField()
    all_participants = models.JSONField(blank=True, null=True)
    players_only = models.JSONField(blank=True, null=True)
    final_winner = models.CharField(max_length=255, blank=True, null=True)
    final_winner_type = models.CharField(max_length=50, blank=True, null=True)
    host = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='hosted_tournaments'
    )

class BaseLobby(models.Model):
    room_id = models.CharField(max_length=10, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    max_rounds = models.IntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(25)]) 
    round_score_limit = models.IntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(25)])
    #TODO make this class abstract?? so it wont have its own object in db

class PlayerCustomization(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="customization")
    paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    def __str__(self):
        return f"{self.user.username} Customization"

class TournamentLobby(models.Model):
    room_id = models.CharField(max_length=10, unique=True)
    active_lobby = models.BooleanField(default=True)
    active_tournament = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_tournament_lobbies")
    guests = models.ManyToManyField(User, related_name="joined_tournament_lobbies")
    max_rounds = models.IntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(25)])
    total_rounds = models.IntegerField(default=2, validators=[MinValueValidator(1), MaxValueValidator(5)])
    # round_score_limit = models.IntegerField(default=3, validators=[MinValueValidator(1), MaxValueValidator(25)])
    max_player_count = models.IntegerField(default=4, validators=[MinValueValidator(4), MaxValueValidator(32)])
    initial_stage = models.CharField(max_length=50, choices=Stage.choices, default=Stage.SEMI_FINALS) # semi finals, because its the stage with the lowest number of participants
    tournament_type = models.CharField(max_length=50, choices=TournamentType.choices, default=TournamentType.SINGLE_ELIMINATION)
    tournament = models.ForeignKey(
        OnlineTournament,
        on_delete=models.SET_NULL, # because tournament is still needed
        related_name="tournament_lobbies",
        null=True,
        blank=True
    )

    guest_ready_states = models.JSONField(default=dict) # {user_id: is_ready}

    host_customization = models.OneToOneField(
        PlayerCustomization,
        on_delete=models.CASCADE,
        related_name="hosted_tournament_lobby",
        null=True,
        blank=True
    )
    guest_customizations = models.ManyToManyField(
        PlayerCustomization,
        related_name="tournament_lobbies",
        blank=True
    )

    def is_full(self):
        return self.guests.count() >= self.max_player_count

    def all_ready(self): # host cannot be ready or not, because host decides when the game starts
        return all(self.guest_ready_states.get(str(guest.id), False) for guest in self.guests.all())

    def set_ready_status(self, user, is_ready):
        """ Set the ready status for the host or guest based on the user. """
        # if user == self.host:
        #     self.is_host_ready = is_ready
        if user in self.guests.all():
            if not self.guest_ready_states:
                self.guest_ready_states = {}
            self.guest_ready_states[str(user.id)] = is_ready
        self.save()

    def set_customization(self, user, paddle_color=None, paddle_image=None):
        """ Set the paddle customization for the host or the guests. """
        if user == self.host:
            if not self.host_customization:
                self.host_customization = PlayerCustomization(user=user)
            self.host_customization.paddle_color = paddle_color or self.host_customization.paddle_color
            self.host_customization.paddle_image = paddle_image or self.host_customization.paddle_image
            self.host_customization.save()
        elif user in self.guests.all():
            customization, created = PlayerCustomization.objects.get_or_create(user=user)
            customization.paddle_color = paddle_color or customization.paddle_color
            customization.paddle_image = paddle_image or customization.paddle_image
            customization.save()
        else:
            raise ValueError("User is not the host or a guest in this lobby.")

    def get_customization(self, user):
        """ Get the paddle customization for the host or the guests. """
        if user == self.host:
            return self.host_customization
        elif user in self.guests.all():
            return self.guest_customizations.get(user=user)
        return None

    def get_lobby_state(self):
        """Return the lobby state with serialized customizations."""
        state = {
            "host": self.host.username,
            "guests": [
                {
                    "username": guest.username,
                    "ready_state": self.guest_ready_states.get(str(guest.id), False)
                }
                for guest in self.guests.all()
            ],
            "all_ready": self.all_ready(),
            "is_full": self.is_full(),
            "active_lobby": self.active_lobby,
            "active_tournament": self.active_tournament,
            "created_at": self.created_at.isoformat(),
            "max_rounds": self.max_rounds,
            # "round_score_limit": self.round_score_limit,
            "max_player_count": self.max_player_count,
            "room_id": self.room_id,
            "tournament_type": self.tournament_type
        }
        return state

    def get_participants(self):
        return [self.host] + list(self.guests.all())

    def get_host_name(self):
        return self.host.username if self.host else "Waiting for host"

class Lobby(BaseLobby):
    # room_id = models.CharField(max_length=10, unique=True)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_lobbies")
    guest = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="joined_lobbies")
    is_host_ready = models.BooleanField(default=False)
    is_guest_ready = models.BooleanField(default=False)
    # is_active = models.BooleanField(default=True)
    # created_at = models.DateTimeField(auto_now_add=True)
    # max_rounds = models.IntegerField(default=3)  # New field for max rounds
    # round_score_limit = models.IntegerField(default=3)  # New field for round score limit
    host_paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    guest_paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    host_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    guest_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    
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
        """Return the lobby state with serialized image URLs."""
        state = {
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
            "room_id": self.room_id,
        }
        
        return state

    def has_guest_joined(self):
        """Returns True if the guest has joined the lobby."""
        return self.guest is not None

class ChaosLobby(BaseLobby):
    # room_id = models.CharField(max_length=10, unique=True)
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_chaos_lobbies")
    guest = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="joined_chaos_lobbies")
    is_host_ready = models.BooleanField(default=False)
    is_guest_ready = models.BooleanField(default=False)
    # is_active = models.BooleanField(default=True)
    # created_at = models.DateTimeField(auto_now_add=True)
    # max_rounds = models.IntegerField(default=3)  # New field for max rounds
    # round_score_limit = models.IntegerField(default=3)  # New field for round score limit
    powerup_spawn_rate = models.FloatField(default=10)  # New field for round score limit
    host_paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    guest_paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    host_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    guest_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    
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
        """Return the lobby state with serialized image URLs."""
        state = {
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
            "powerup_spawn_rate": self.powerup_spawn_rate,
            "room_id": self.room_id,
        }
        
        return state

    def has_guest_joined(self):
        """Returns True if the guest has joined the lobby."""
        return self.guest is not None

class ArenaLobby(BaseLobby):
    # room_id = models.CharField(max_length=10, unique=True)
    player_one = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hosted_lobbies_p1")
    player_two = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="joined_lobbies_p2")
    player_three = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="joined_lobbies_p3")
    player_four = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="joined_lobbies_p4")

    is_player_one_ready = models.BooleanField(default=False)
    is_player_two_ready = models.BooleanField(default=False)
    is_player_three_ready = models.BooleanField(default=False)
    is_player_four_ready = models.BooleanField(default=False)

    player_one_paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    player_two_paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    player_three_paddle_color = models.CharField(max_length=7, default="#FFFFFF")
    player_four_paddle_color = models.CharField(max_length=7, default="#FFFFFF")

    player_one_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    player_two_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    player_three_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)
    player_four_paddle_image = models.ImageField(upload_to='paddle_skins/', null=True, blank=True)

    # is_active = models.BooleanField(default=True)
    # created_at = models.DateTimeField(auto_now_add=True)
    # max_rounds = models.IntegerField(default=3)
    # round_score_limit = models.IntegerField(default=3)

    def is_full(self):
        return self.player_two is not None and self.player_three is not None and self.player_four is not None

    def all_ready(self):
        return self.is_player_one_ready and self.is_player_two_ready and self.is_player_three_ready and self.is_player_four_ready

    def get_host_name(self):
        return self.player_one.username if self.player_one else "Waiting for host"

    def get_player_two_name(self):
        return self.player_two.username if self.player_two else "Waiting for guest"

    def get_player_three_name(self):
        return self.player_three.username if self.player_three else "Waiting for guest"

    def get_player_four_name(self):
        return self.player_four.username if self.player_four else "Waiting for guest"

    def set_ready_status(self, user, is_ready):
        """ Set the ready status for the host or guest based on the user. """
        if user == self.player_one:
            self.is_player_one_ready = is_ready
        elif user == self.player_two:
            self.is_player_two_ready = is_ready
        elif user == self.player_three:
            self.is_player_three_ready = is_ready
        elif user == self.player_four:
            self.is_player_four_ready = is_ready
        self.save()

    def get_lobby_state(self):
        """Return the lobby state with serialized image URLs."""
        state = {
            "is_player_one_ready": self.is_player_one_ready,
            "is_player_two_ready": self.is_player_two_ready,
            "is_player_three_ready": self.is_player_three_ready,
            "is_player_four_ready": self.is_player_four_ready,
            "all_ready": self.all_ready(),
            "player_one_name": str(self.player_one.username) if self.player_one else None,
            "player_two_name": str(self.player_two.username) if self.player_two else None,
            "player_three_name": str(self.player_three.username) if self.player_three else None,
            "player_four_name": str(self.player_four.username) if self.player_four else None,
            "is_full": self.is_full(),
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "max_rounds": self.max_rounds,
            "round_score_limit": self.round_score_limit,
            "room_id": self.room_id,
        }
        return state

    def has_player_two_joined(self):
        """Returns True if player two has joined the lobby."""
        return self.player_two is not None

    def has_player_three_joined(self):
        """Returns True if player three has joined the lobby."""
        return self.player_three is not None

    def has_player_four_joined(self):
        """Returns True if player four has joined the lobby."""
        return self.player_four is not None


class Game(models.Model):
    # Game Modes
    PVE = 'pve'
    LOCAL_PVP = 'local_pvp'
    ONLINE_PVP = 'online_pvp'
    CHAOS_PVE = 'chaos_pve'
    CHAOS_PVP = 'chaos_pvp'
    ONLINE_CHAOS_PVP = 'online_chaos_pvp'
    ARENA_PVP = 'arena_pvp'
    ONLINE_ARENA_PVP = 'online_arena_pvp'

    GAME_MODES = [
        (PVE, 'Player vs AI'),
        (LOCAL_PVP, 'Local Player vs Local Player'),
        (ONLINE_PVP, 'Online Player vs Online Player'),
        (CHAOS_PVE, 'Chaos Player vs AI'),
        (CHAOS_PVP, 'Chaos Player vs Player'),
        (ONLINE_CHAOS_PVP, 'Online Chaos Player vs Player'),
        (ARENA_PVP, 'Arena Player vs Player'),
        (ONLINE_ARENA_PVP, 'Online Arena Player vs Player')
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
    lobby = models.ForeignKey(BaseLobby, on_delete=models.CASCADE, related_name='games', null=True, blank=True, default=None)
    
    
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

    player3 = models.ForeignKey( # Player 3 is only used in Arena mode
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='games_as_player3', 
        blank=True, null=True
    )

    player4 = models.ForeignKey( # Player 4 is only used in Arena mode
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='games_as_player4', 
        blank=True, null=True
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
    score_player3 = models.IntegerField(default=0) # Only used in Arena mode
    score_player4 = models.IntegerField(default=0) # Only used in Arena mode

    winner = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        related_name='games_won', 
        null=True, blank=True
    )
    is_completed = models.BooleanField(default=False)

    def is_against_ai(self):
        """ Check if the game is a PvE game against an AI. """
        return self.player2 is None and self.game_mode in [Game.PVE, Game.CHAOS_PVE]

    def __str__(self):
        return f"{self.player1.username} vs {self.player2_name_pvp_local or self.player2 or 'AI'} - {self.game_mode}"

    class Meta:
        ordering = ['-start_time']
