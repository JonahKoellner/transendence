import { Component, OnInit, OnDestroy } from '@angular/core';
import { Game, GameService, MoveLog, Round, Player } from '../game.service';
import { ProfileService, UserProfile } from 'src/app/profile.service';

export interface GameSettings {
  maxRounds: number;
  roundScoreLimit: number;
  paddleskin_image?: string;
  ballskin_color?: string;
  ballskin_image?: string;
  gamebackground_color?: string;
  gamebackground_wallpaper?: string;
}

@Component({
  selector: 'app-arena',
  templateUrl: './arena.component.html',
  styleUrls: ['./arena.component.scss']
})
export class ArenaComponent implements OnInit, OnDestroy {
  currentGame: Game | null = null;
  gameInProgress: boolean = false;
  logs: string[] = [];
  previousGames: string[] = [];
  gameElapsedTime: string = '0 seconds';
  roundElapsedTime: string = '0 seconds';
  hostProfile: UserProfile | null = null;
  gameId: string = '';

  player1Name: string = 'Player 1';
  player2Name: string = 'Player 2';
  player3Name: string = 'Player 3';
  player4Name: string = 'Player 4';

  private gameIntervalId: any;
  private roundIntervalId: any;

  settings: GameSettings = {
    maxRounds: 3,
    roundScoreLimit: 3
  };

  constructor(private gameService: GameService, private profileService: ProfileService) {}

  ngOnInit(): void {
    this.profileService.getProfile().subscribe(
      profile => {
        this.hostProfile = profile;
        this.player1Name = profile.display_name || profile.username;
      },
      error => {
        console.error('Failed to load profile:', error);
      }
    );
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  startNewGame(): void {
    if (!this.validateSettings()) return;

    const newGame: Game = {
      game_mode: 'arena_pvp',
      player1: { id: this.hostProfile!.id, username: this.player1Name },
      player2: { id: 0, username: this.player2Name },
      player3: { id: 0, username: this.player3Name },
      player4: { id: 0, username: this.player4Name },
      start_time: new Date().toISOString(),
      scores: {
        player1: 0,
        player2: 0,
        player3: 0,
        player4: 0
      },
      is_completed: false,
      moves_log: [],
      rounds: [],
      duration: undefined,
      end_time: undefined,
      winner: null,
      score_player1: 0,
      score_player2: 0
    };

    this.gameService.createGame(newGame).subscribe( (game) => {
      console.log('Game created:', game);
      this.gameId = game.id?.toString() || '';
      if (this.logs.length) {
        this.previousGames.push(...this.logs);
        this.logs = [];
      }
      this.currentGame = newGame;
      this.gameInProgress = true;
      this.logs.push(
        `New game started among ${this.player1Name}, ${this.player2Name}, ${this.player3Name}, and ${this.player4Name}`
      );
      this.startTimers();
      this.startNewRound();
    });
  }

  startTimers(): void {
    this.clearTimers();
    const gameStart = new Date();

    this.gameIntervalId = setInterval(() => {
      const elapsed = Math.floor((new Date().getTime() - gameStart.getTime()) / 1000);
      this.gameElapsedTime = `${elapsed} seconds`;
    }, 1000);
  }

  startRoundTimer(): void {
    this.clearRoundTimer();
    const roundStart = new Date();

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
      scores: {
        player1: 0,
        player2: 0,
        player3: 0,
        player4: 0
      },
      winner: '',
      score_player1: 0,
      score_player2: 0
    };

    this.currentGame.rounds.push(newRound);
    this.logs.push(`Round ${roundNumber} started.`);
    this.startRoundTimer();
  }

  updateScore(player: 'player1' | 'player2' | 'player3' | 'player4'): void {
    if (!this.currentGame || !this.gameInProgress) return;

    const currentRound = this.getCurrentRound();
    const playerName = (this as any)[`player${player.charAt(player.length - 1)}Name`];

    const move: MoveLog = {
      time: new Date().toISOString(),
      player: playerName,
      action: 'scored',
    };
    this.currentGame.moves_log.push(move);

    if (currentRound.scores) {
      currentRound.scores[player]++;
    }
    this.logs.push(`Round ${currentRound.round_number}: ${playerName} scored.`);

    this.checkRoundCompletion(currentRound);
    this.checkGameCompletion();
  }

  getCurrentRound(): Round {
    return this.currentGame!.rounds[this.currentGame!.rounds.length - 1];
  }

  private checkRoundCompletion(round: Round): void {
    const players = ['player1', 'player2', 'player3', 'player4'] as const;
    for (const player of players) {
      if (this.currentGame?.scores && round.scores && round.scores[player] >= this.settings.roundScoreLimit) {
        round.end_time = new Date().toISOString();
        round.winner = (this as any)[`player${player.charAt(player.length - 1)}Name`];
        this.currentGame!.scores[player]++;
        this.logs.push(`Round ${round.round_number} ended. Winner: ${round.winner}`);
        this.clearRoundTimer();

        if (this.currentGame!.rounds.length < this.settings.maxRounds && !this.currentGame!.is_completed) {
          this.startNewRound();
        }
        break;
      }
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
    this.clearTimers();

    // Determine overall winner
    const scores = this.currentGame!.scores;
    const maxScore = Math.max(scores!.player1, scores!.player2, scores!.player3, scores!.player4);
    const winners = Object.keys(scores!).filter(player => scores![player as keyof typeof scores] === maxScore);

    if (winners.length === 1) {
      const winnerKey = winners[0] as 'player1' | 'player2' | 'player3' | 'player4';
      const playerNameKey = `player${winnerKey.charAt(winnerKey.length - 1)}Name` as keyof ArenaComponent;
      this.currentGame!.winner = { id: 0, username: this[playerNameKey] as string };
    } else {
      this.currentGame!.winner = { id: -1, username: 'Tie' };
    }

    this.gameInProgress = false;
    this.logs.push(`Game ended. Winner: ${this.currentGame!.winner?.username || 'Tie'}`);
    console.log('Game ended:', this.currentGame);
    if (this.currentGame && this.gameId) {
      const updatedGameData: Partial<Game> = {
        end_time: this.currentGame.end_time,
        duration: this.currentGame.duration,
        is_completed: true,
        winner: this.currentGame.winner,
        scores: this.currentGame.scores,
        moves_log: this.currentGame.moves_log,
        rounds: this.currentGame.rounds,
      };

      this.gameService.updateGame(Number(this.gameId), updatedGameData).subscribe((updatedGame) => {
        console.log('Game updated:', updatedGame);
        this.currentGame = { ...this.currentGame, ...updatedGame };
      });
    }
  }

  get isReady(): boolean {
    return this.currentGame !== null && this.gameInProgress;
  }

  calculateRoundDuration(round: Round): string {
    if (round.end_time) {
      const duration = (new Date(round.end_time).getTime() - new Date(round.start_time).getTime()) / 1000;
      return `${duration.toFixed(2)} seconds`;
    }
    return 'In Progress';
  }
}
