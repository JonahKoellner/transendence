import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Game, GameService } from '../game.service';
import { Chart } from 'chart.js';
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
        this.loadStats();
      },
      (error) => {
        this.toastr.error('Failed to load game details.', 'Error');
        this.errorMessage = 'Failed to load game details.';
        this.isLoading = false;
      }
    );
  }

  loadStats(): void {
    this.gameService.getGameStats(this.gameId).subscribe({
      next: (data: any) => {
        this.gameStats = data;
        this.cdr.detectChanges(); // Ensure view is updated
        // this.initCharts();
        this.isLoading = false;
      },
      error: (error) => {
        this.toastr.error('Failed to load game statistics.', 'Error');
        this.errorMessage = 'Failed to load game statistics.';
        this.isLoading = false;
      }
    });
  }

  initCharts(): void {
    if (!this.gameStats) {
      return;
    }
  
    // Chart 1: Game Mode
    const ctxGameMode = this.gameModeChart.nativeElement.getContext('2d');
    if (ctxGameMode) {
      new Chart(ctxGameMode, {
        type: 'pie',
        data: {
          labels: [this.gameStats.game_mode],
          datasets: [{
            data: [1],
            backgroundColor: ['#42a5f5']
          }]
        },
        options: { responsive: true }
      });
    }
  
    // Chart 2: Game Duration
    const ctxGameDuration = this.gameDurationChart.nativeElement.getContext('2d');
    if (ctxGameDuration) {
      new Chart(ctxGameDuration, {
        type: 'bar',
        data: {
          labels: ['Game Duration (seconds)'],
          datasets: [{
            label: 'Duration',
            data: [this.gameStats.game_duration],
            backgroundColor: ['#ff9f40']
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }
  
    // Chart 3: Win/Loss Status
    const ctxWinLoss = this.winLossChart.nativeElement.getContext('2d');
    if (ctxWinLoss) {
      new Chart(ctxWinLoss, {
        type: 'pie',
        data: {
          labels: ['Winner', 'Status'],
          datasets: [{
            data: [this.gameStats.win_loss_status.Winner === 'None' ? 0 : 1, 1],
            backgroundColor: ['#61BA50', '#f44336']
          }]
        },
        options: { responsive: true }
      });
    }
  
    // Chart 4: Rounds Information
    const ctxRounds = this.roundsChart.nativeElement.getContext('2d');
    if (ctxRounds && this.gameStats.rounds_info.length > 0) {
      const labels = this.gameStats.rounds_info.map((round: any) => `Round ${round.round_number}`);
      const scoresPlayer1 = this.gameStats.rounds_info.map((round: any) => round.score_player1);
      const scoresPlayer2 = this.gameStats.rounds_info.map((round: any) => round.score_player2);
  
      new Chart(ctxRounds, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Player 1 Score', data: scoresPlayer1, backgroundColor: '#42a5f5' },
            { label: 'Player 2 Score', data: scoresPlayer2, backgroundColor: '#66bb6a' }
          ]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }
  
    // Chart 5: Moves Log
    const ctxMovesLog = this.movesLogChart.nativeElement.getContext('2d');
    if (ctxMovesLog && this.gameStats.moves_log.length > 0) {
      const times = this.gameStats.moves_log.map((move: any) => move.time);
      const actions = this.gameStats.moves_log.map((move: any) => move.action);
      const players = this.gameStats.moves_log.map((move: any) => move.player);
  
      new Chart(ctxMovesLog, {
        type: 'line',
        data: {
          labels: times,
          datasets: [{
            label: 'Moves Log',
            data: actions.map(() => 1),
            backgroundColor: players.map((player: any) => player === this.game?.player1.username ? '#42a5f5' : '#66bb6a')
          }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }
  
    // Chart 6: Score Distribution
    const ctxScoreDistribution = this.scoreDistributionChart.nativeElement.getContext('2d');
    if (ctxScoreDistribution) {
      new Chart(ctxScoreDistribution, {
        type: 'doughnut',
        data: {
          labels: ['Player 1', 'Player 2'],
          datasets: [{
            data: [this.gameStats.score_distribution['Player 1'], this.gameStats.score_distribution['Player 2']],
            backgroundColor: ['#36a2eb', '#ff6384']
          }]
        },
        options: { responsive: true }
      });
    }
  
    // Chart 7: Game Status
    const ctxGameStatus = this.gameStatusChart.nativeElement.getContext('2d');
    if (ctxGameStatus) {
      new Chart(ctxGameStatus, {
        type: 'doughnut',
        data: {
          labels: [this.gameStats.game_status],
          datasets: [{ data: [1], backgroundColor: ['#ffcd56'] }]
        },
        options: { responsive: true }
      });
    }
  
    // Chart 8: Winner Information
    const ctxWinner = this.winnerChart.nativeElement.getContext('2d');
    if (ctxWinner) {
      new Chart(ctxWinner, {
        type: 'pie',
        data: {
          labels: ['Winner', 'Is Completed'],
          datasets: [{
            data: [this.gameStats.winner_info.is_completed ? 1 : 0, 1],
            backgroundColor: ['#4bc0c0', '#ff6384']
          }]
        },
        options: { responsive: true }
      });
    }
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
