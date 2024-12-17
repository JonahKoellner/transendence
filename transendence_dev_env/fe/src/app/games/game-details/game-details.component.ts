import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Game, GameService } from '../game.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-game-details',
  templateUrl: './game-details.component.html',
  styleUrls: ['./game-details.component.scss']
})
export class GameDetailsComponent implements OnInit, AfterViewInit {
  @ViewChild('gameModeChart') gameModeChart!: ElementRef;
  @ViewChild('gameDurationChart') gameDurationChart!: ElementRef;
  @ViewChild('winLossChart') winLossChart!: ElementRef;
  @ViewChild('roundsChart') roundsChart!: ElementRef;
  @ViewChild('movesLogChart') movesLogChart!: ElementRef;
  @ViewChild('scoreDistributionChart') scoreDistributionChart!: ElementRef;
  @ViewChild('gameStatusChart') gameStatusChart!: ElementRef;
  @ViewChild('winnerChart') winnerChart!: ElementRef;

  gameId: string = '';
  game: Game | null = null;
  errorMessage: string = '';
  isLoading = true;
  gameStats!: any;

  constructor(
    private route: ActivatedRoute, 
    private gameService: GameService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        this.gameId = idParam;
        this.loadGameDetails(this.gameId);
      } else {
        this.errorMessage = 'Invalid game ID.';
        this.isLoading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    // Charts will be initialized after data is loaded
  }

  loadGameDetails(gameId: string): void {
    this.gameService.getGameById(parseInt(gameId, 10)).subscribe(
      (game) => { 
        this.game = game;
        this.cdr.detectChanges(); // Ensure view is updated
        this.isLoading = false;
      },
      (error) => {
        this.toastr.error('Failed to load game details.', 'Error');
        this.errorMessage = 'Failed to load game details.';
        this.isLoading = false;
      }
    );
  }

  getMonthName(monthNumber: number): string {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString('default', { month: 'short' });
  }

  generateColors(count: number): string[] {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
      '#9966FF', '#FF9F40', '#C9CBCF', '#FFCD56',
      '#8BC34A', '#FF9800', '#00BCD4', '#E91E63'
    ];
    // Repeat colors if count exceeds the predefined colors
    while (colors.length < count) {
      colors.push(...colors);
    }
    return colors.slice(0, count);
  }

  getGameStatus(game: any): string {
    if (!game) {
      return 'Unknown';
    }

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
