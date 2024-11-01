import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Game, GameService } from '../game.service';

@Component({
  selector: 'app-game-details',
  templateUrl: './game-details.component.html',
  styleUrls: ['./game-details.component.scss']
})
export class GameDetailsComponent implements OnInit {
  gameId: string = '';
  game: Game | null = null;
  errorMessage: string = '';
  isLoading = true;

  constructor(private route: ActivatedRoute, private gameService: GameService) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.gameId = params.get('id')!;
      this.loadGameDetails(this.gameId);
    });
  }

  // Load game details from the service
  loadGameDetails(gameId: string): void {
    this.gameService.getGameById(parseInt(gameId, 10)).subscribe(
      (game) => {this.game = game; this.isLoading = false;},
      (error) => {
        console.error('Error loading game details:', error);
        this.errorMessage = 'Failed to load game details.';
        this.isLoading = false;
      }
    );
  }
  getGameStatus(game: any): string {
    const currentTime = new Date();
    const startTime = new Date(game.start_time);

    // Check if game is completed
    if (game.is_completed) {
      return 'Completed';
    }

    const TEN_MINUTES = 10 * 60 * 1000; // milliseconds in ten minutes
    if (!game.end_time && (currentTime.getTime() - startTime.getTime() > TEN_MINUTES)) {
      return 'Canceled';
    }

    // If the game has started but not completed, it's still "Running"
    if (game.start_time && !game.is_completed) {
      return 'Running';
    }

    return 'Unknown';
  }
}