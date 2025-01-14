import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Game, GameService, MoveLog, Round, Player } from '../game.service';
import { ProfileService, UserProfile } from 'src/app/profile.service';

export interface GameSettings {
  maxRounds: number;
  roundScoreLimit: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  paddleskin_color?: string;
  paddleskin_image?: string;
  ballskin_color?: string;
  ballskin_image?: string;
  gamebackground_color?: string;
  gamebackground_wallpaper?: string;
  enemyType: 'AI' | 'PvP';
}

@Component({
  selector: 'app-three-d',
  templateUrl: './three-d.component.html',
  styleUrls: ['./three-d.component.scss']
})
export class ThreeDComponent  implements OnInit, OnDestroy {
  @ViewChild('gameContainer', { static: false }) gameContainer!: ElementRef;
  currentGame: Game | null = null;
  gameInProgress: boolean = false;
  logs: string[] = [];
  previousGames: string[] = [];
  gameElapsedTime: string = '0 seconds';
  roundElapsedTime: string = '0 seconds';
  hostProfile: UserProfile | null = null; // Default until profile loads
  private gameIntervalId: any;
  private roundIntervalId: any;
  player2Name: string = 'Player 2';

  displayNameHost: string = 'Player 1';

  settings: GameSettings = {
    maxRounds: 3,
    roundScoreLimit: 3,
    difficulty: 'Medium', // Default difficulty
    enemyType: 'AI'
  };

  constructor(private gameService: GameService, private profileService: ProfileService) {}

  ngOnInit(): void {
    this.profileService.getProfile().subscribe(
      profile => {
        this.hostProfile = profile;
        this.settings.paddleskin_color = profile.paddleskin_color;
        this.settings.paddleskin_image = profile.paddleskin_image;
        this.settings.ballskin_color = profile.ballskin_color;
        this.settings.ballskin_image = profile.ballskin_image;
        this.settings.gamebackground_color = profile.gamebackground_color;
        this.settings.gamebackground_wallpaper = profile.gamebackground_wallpaper;
      },
      error => {
        console.error('Failed to load profile:', error);
      }
    );
  }

  ngOnDestroy(): void {
    this.clearTimers(); // Clear intervals when the component is destroyed
  }

  startNewGame(): void {
    if (!this.validateSettings()) return;
    this.displayNameHost = this.hostProfile?.display_name || this.hostProfile?.username || 'Player 1';
    const player2_toSet = this.settings.enemyType === 'PvP' ? this.player2Name : 'AI';
    const newGame: Game = {
      game_mode: this.settings.enemyType === 'AI' ? '3d_pve' : '3d_pvp',
      player1: { id: this.hostProfile?.id || -1, username: this.displayNameHost },
      player2: this.settings.enemyType === 'AI' ? { id: 0, username:player2_toSet } : { id: 0, username: player2_toSet },
      start_time: new Date().toISOString(),
      score_player1: 0,
      score_player2: 0,
      is_completed: false,
      moves_log: [],
      rounds: [],
      duration: undefined,
      end_time: undefined,
      winner: null,
    };

    if (this.settings.enemyType === 'PvP') {
      newGame.player2_name_pvp_local = this.player2Name;
    }

    this.gameService.createGame(newGame).subscribe((game) => {
      if (this.logs.length) {
        this.previousGames.push(...this.logs);
        this.logs = [];
      }
      this.currentGame = game;
      this.gameInProgress = true;
      this.logs.push('New game started in PvE mode');
      this.startTimers();
      this.startNewRound();
    });
  }

  startTimers(): void {
    this.clearTimers(); // Clear any existing timers
    const gameStart = new Date();

    // Game timer
    this.gameIntervalId = setInterval(() => {
      const elapsed = Math.floor((new Date().getTime() - gameStart.getTime()) / 1000);
      this.gameElapsedTime = `${elapsed} seconds`;
    }, 1000);
  }

  startRoundTimer(): void {
    this.clearRoundTimer(); // Clear any existing round timer
    const roundStart = new Date();

    // Round timer
    this.roundIntervalId = setInterval(() => {
      const elapsed = Math.floor((new Date().getTime() - roundStart.getTime()) / 1000);
      this.roundElapsedTime = `${elapsed} seconds`;
    }, 1000);
  }

  clearTimers(): void {
    if (this.gameIntervalId) clearInterval(this.gameIntervalId);
    this.clearRoundTimer();
  }

  clearRoundTimer(): void {
    if (this.roundIntervalId) clearInterval(this.roundIntervalId);
  }

  validateSettings(): boolean {
    if (this.settings.maxRounds <= 0 || this.settings.roundScoreLimit <= 0) {
      this.logs.push('Settings values must be positive.');
      return false;
    }
    return true;
  }

  private startNewRound(): void {
    if (!this.currentGame || this.currentGame.rounds.length >= this.settings.maxRounds) return;

    const roundNumber = this.currentGame.rounds.length + 1;
    const newRound: Round = {
      round_number: roundNumber,
      start_time: new Date().toISOString(),
      score_player1: 0,
      score_player2: 0,
      winner: '' // Initialize winner as empty
    };

    this.currentGame.rounds.push(newRound);
    this.logs.push(`Round ${roundNumber} started.`);
    this.startRoundTimer(); // Start the round timer
  }

  updateScoreBot(player: 'human' | 'bot'): void {
    if (!this.currentGame || !this.gameInProgress) return;

    const currentRound = this.getCurrentRound();
    const scoringPlayer = player === 'human' ? this.displayNameHost : 'AI';

    const move: MoveLog = {
      time: new Date().toISOString(),
      player: scoringPlayer,
      action: 'scored',
    };
    this.currentGame.moves_log.push(move);
    this.logs.push(`${move.player} ${move.action}`);

    if (player === 'human')
      currentRound.score_player1++;
    else
      currentRound.score_player2++;
  
    this.checkRoundCompletion(currentRound);
    this.checkGameCompletion();
  }

  updateScorePvp(player: 'player1' | 'player2'): void {
    if (!this.currentGame || !this.gameInProgress) return;

    const currentRound = this.getCurrentRound();
    const playerName = player === 'player1' ? this.displayNameHost : this.player2Name;

    const move: MoveLog = {
      time: new Date().toISOString(),
      player: playerName,
      action: 'scored',
    };
    this.currentGame.moves_log.push(move);

    if (player === 'player1')
      currentRound.score_player1++;
    else
      currentRound.score_player2++;

     this.logs.push(`Round ${this.getCurrentRound().round_number} ${playerName} scored.`);


    this.checkRoundCompletion(currentRound);
    this.checkGameCompletion();
  }

  getCurrentRound(): Round {
    return this.currentGame!.rounds[this.currentGame!.rounds.length - 1];
  }

  private checkRoundCompletion(round: Round): void {
    if (round.score_player1 >= this.settings.roundScoreLimit || round.score_player2 >= this.settings.roundScoreLimit) {
      round.end_time = new Date().toISOString();
      if (round.score_player1 > round.score_player2)
        round.winner = this.currentGame!.player1.username;
      else
        round.winner = this.currentGame!.player2.username;
      if (round.winner == this.currentGame!.player1.username)
        this.currentGame!.score_player1++;
      else
        this.currentGame!.score_player2++;
      this.logs.push(`Round ${round.round_number} ended. Winner: ${round.winner || 'None'}`);
      this.clearRoundTimer(); // Stop the round timer

      if (this.currentGame!.rounds.length < this.settings.maxRounds && !this.currentGame!.is_completed)
        this.startNewRound();
    }
  }

  private checkGameCompletion(): void {
    if (this.currentGame!.rounds.length >= this.settings.maxRounds && this.getCurrentRound().winner)
      this.endGame();
  }

  private endGame(): void {
    const now = new Date();
    this.currentGame!.end_time = now.toISOString();
    this.currentGame!.duration = (now.getTime() - new Date(this.currentGame!.start_time).getTime()) / 1000;
    this.currentGame!.is_completed = true;
    this.clearTimers(); // Stop all timers

    // Determine and set the game winner based on scores
    if (this.currentGame!.score_player1 > this.currentGame!.score_player2)
      this.currentGame!.winner = this.currentGame!.player1;
    else if (this.currentGame!.score_player1 < this.currentGame!.score_player2)
      this.currentGame!.winner = this.currentGame!.player2;
    else
      this.currentGame!.winner = {id: -1, username: 'Tie'};

    this.gameInProgress = false;
    this.logs.push(`Game ended. Winner: ${this.currentGame!.winner.username || 'None'}`);

    if (this.currentGame && this.currentGame.id) {
      const updatedGameData: Partial<Game> = {
        end_time: this.currentGame.end_time,
        duration: this.currentGame.duration,
        is_completed: true,
        winner: this.currentGame.winner,
        score_player1: this.currentGame.score_player1,
        score_player2: this.currentGame.score_player2,
        moves_log: this.currentGame.moves_log,
        rounds: this.currentGame.rounds,
      };

      this.gameService.updateGame(this.currentGame.id, updatedGameData).subscribe((updatedGame) => {
        this.currentGame = { ...this.currentGame, ...updatedGame };
      });
    }
  }

  calculateRoundDuration(round: Round): string {
    if (round.end_time) {
      const duration = (new Date(round.end_time).getTime() - new Date(round.start_time).getTime()) / 1000;
      return `${duration.toFixed(2)} seconds`;
    }
    return 'In Progress';
  }
}
