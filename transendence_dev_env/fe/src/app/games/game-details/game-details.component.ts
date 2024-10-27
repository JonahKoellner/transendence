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
      (game) => this.game = game,
      (error) => {
        console.error('Error loading game details:', error);
        this.errorMessage = 'Failed to load game details.';
      }
    );
  }
}