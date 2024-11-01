from django.db import models
from django.conf import settings
from django.utils import timezone

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
