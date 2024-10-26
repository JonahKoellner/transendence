import { Component } from '@angular/core';
import { Game, GameService } from '../game.service';

@Component({
  selector: 'app-selection',
  templateUrl: './selection.component.html',
  styleUrls: ['./selection.component.scss'],
})
export class SelectionComponent {
  games: Game[] = [];      // Holds fetched games
  selectedGameMode: string = ''; // Tracks selected game mode
  logs: string[] = [];      // For displaying logs or feedback

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    this.fetchGames();  // Initial fetch of all games
  }

  // Fetch all games
  fetchGames(): void {
    this.gameService.getGames().subscribe(
      (games) => {
        this.games = Array.isArray(games) ? [...games] : []; // Ensure `games` is an array
        this.logs = [...this.logs, 'Fetched all games successfully.'];
      },
      (error) => {
        console.error('Failed to fetch games:', error);
        this.logs = [...this.logs, 'Failed to fetch games.'];
      }
    );
  }

  // Create a new game based on selected game mode
  createGame(gameMode: string): void {
    const newGame: Game = {
      game_mode: gameMode,
      player1: { id: 1, username: 'PlayerOne' },  // Replace with actual player data
      player2: null,
      start_time: new Date().toISOString(),
      score_player1: 0,
      score_player2: 0,
      is_completed: false
    };
  
    this.gameService.createGame(newGame).subscribe(
      (game) => {
        this.games = [...this.games, game]; // Use spread operator for immutable update
        this.logs = [...this.logs, `Created a new game in ${gameMode} mode.`];
      },
      (error) => {
        console.error('Failed to create game:', error);
        this.logs = [...this.logs, `Failed to create game in ${gameMode} mode.`];
      }
    );
  }

  // Set selected game mode and create game
  selectGameMode(gameMode: string): void {
    this.selectedGameMode = gameMode;
    this.createGame(gameMode);
  }
}