import { Component, OnInit, AfterViewInit, AfterViewChecked, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Game, GameService } from '../game.service';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-game-details',
  templateUrl: './game-details.component.html',
  styleUrls: ['./game-details.component.scss']
})
export class GameDetailsComponent implements OnInit, AfterViewChecked {
  @ViewChild('totalGamesChart') totalGamesChart!: ElementRef;
  @ViewChild('winRateChart') winRateChart!: ElementRef;
  @ViewChild('averageDurationChart') averageDurationChart!: ElementRef;
  @ViewChild('gamesOverTimeChart') gamesOverTimeChart!: ElementRef;
  @ViewChild('averageScorePerModeChart') averageScorePerModeChart!: ElementRef;
  @ViewChild('winRatePerModeChart') winRatePerModeChart!: ElementRef;
  @ViewChild('scoresDistributionChart') scoresDistributionChart!: ElementRef;
  @ViewChild('winDistributionPerModeChart') winDistributionPerModeChart!: ElementRef;

  gameId: string = '';
  game: Game | null = null;
  errorMessage: string = '';
  isLoading = true;
  gameStats!: any;

  private chartsInitialized = false; // Flag to prevent multiple initializations

  constructor(
    private route: ActivatedRoute, 
    private gameService: GameService,
    private cdr: ChangeDetectorRef
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


  ngAfterViewChecked(): void {
    // Initialize charts once the view is updated with gameStats and charts are not initialized yet
    if (this.gameStats && !this.chartsInitialized) {
      this.initCharts();
      this.chartsInitialized = true;
    }
  }

  loadGameDetails(gameId: string): void {
    this.gameService.getGameById(parseInt(gameId, 10)).subscribe(
      (game) => { 
        this.game = game; 
        this.loadStats();
      },
      (error) => {
        console.error('Error loading game details:', error);
        this.errorMessage = 'Failed to load game details.';
        this.isLoading = false;
      }
    );
  }

  loadStats(): void {
    console.log("Stats loading...");
    this.gameService.getGameStats(this.gameId).subscribe({
      next: (data: any) => {
        this.gameStats = data;
        console.log('Game Stats:', this.gameStats);
        this.cdr.detectChanges(); // Ensure view is updated
        this.isLoading = false;
        // Charts will be initialized in ngAfterViewChecked
      },
      error: (error) => {
        console.error("Error fetching game stats:", error);
        this.errorMessage = 'Failed to load game statistics.';
        this.isLoading = false;
      }
    });
  }

  initCharts(): void {
    if (!this.gameStats) {
      console.error("Game stats are null.");
      return;
    }

    // Initialize Total Games Chart
    if (this.totalGamesChart && this.totalGamesChart.nativeElement) {
      const ctxTotalGames = this.totalGamesChart.nativeElement.getContext('2d');
      if (ctxTotalGames) {
        new Chart(ctxTotalGames, {
          type: 'doughnut',
          data: {
            labels: ['PvE', 'Local PvP', 'Online PvP'],
            datasets: [{
              data: [
                this.gameStats.total_games.PvE, 
                this.gameStats.total_games['Local PvP'], 
                this.gameStats.total_games['Online PvP']
              ],
              backgroundColor: ['#ff6384', '#36a2eb', '#ffcd56']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      } else {
        console.error("Cannot acquire context for totalGamesChart.");
      }
    } else {
      console.error("totalGamesChart ViewChild is undefined.");
    }

    // Initialize Win Rate Chart
    if (this.winRateChart && this.winRateChart.nativeElement) {
      const ctxWinRate = this.winRateChart.nativeElement.getContext('2d');
      if (ctxWinRate) {
        new Chart(ctxWinRate, {
          type: 'doughnut',
          data: {
            labels: ['Wins', 'Losses'],
            datasets: [{
              data: [this.gameStats.win_rate.Wins, this.gameStats.win_rate.Losses],
              backgroundColor: ['#61BA50', '#f44336']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      } else {
        console.error("Cannot acquire context for winRateChart.");
      }
    } else {
      console.error("winRateChart ViewChild is undefined.");
    }

    // Initialize Average Duration Chart
    if (this.averageDurationChart && this.averageDurationChart.nativeElement) {
      const ctxAverageDuration = this.averageDurationChart.nativeElement.getContext('2d');
      if (ctxAverageDuration) {
        new Chart(ctxAverageDuration, {
          type: 'bar',
          data: {
            labels: ['Average Duration (seconds)'],
            datasets: [{
              label: 'Average Duration',
              data: [this.gameStats.average_duration],
              backgroundColor: ['#ff9f40']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      } else {
        console.error("Cannot acquire context for averageDurationChart.");
      }
    } else {
      console.error("averageDurationChart ViewChild is undefined.");
    }

    // Initialize Games Over Time Chart
    if (this.gamesOverTimeChart && this.gamesOverTimeChart.nativeElement) {
      const ctxGamesOverTime = this.gamesOverTimeChart.nativeElement.getContext('2d');
      if (ctxGamesOverTime) {
        const months = this.gameStats.games_over_time.map((entry: { month: number; }) => this.getMonthName(entry.month));
        const counts = this.gameStats.games_over_time.map((entry: { count: any; }) => entry.count);
        new Chart(ctxGamesOverTime, {
          type: 'line',
          data: {
            labels: months,
            datasets: [{
              label: 'Games Played',
              data: counts,
              fill: false,
              borderColor: '#36a2eb',
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      } else {
        console.error("Cannot acquire context for gamesOverTimeChart.");
      }
    } else {
      console.error("gamesOverTimeChart ViewChild is undefined.");
    }

    // Initialize Average Score per Game Mode Chart
    if (this.averageScorePerModeChart && this.averageScorePerModeChart.nativeElement) {
      const ctxAverageScorePerMode = this.averageScorePerModeChart.nativeElement.getContext('2d');
      if (ctxAverageScorePerMode) {
        const avgScoreLabels = Object.keys(this.gameStats.average_score_per_mode);
        const avgScoreData = Object.values(this.gameStats.average_score_per_mode);
        new Chart(ctxAverageScorePerMode, {
          type: 'bar',
          data: {
            labels: avgScoreLabels,
            datasets: [{
              label: 'Average Score',
              data: avgScoreData,
              backgroundColor: '#4bc0c0'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: {
                beginAtZero: true
              }
            }
          }
        });
      } else {
        console.error("Cannot acquire context for averageScorePerModeChart.");
      }
    } else {
      console.error("averageScorePerModeChart ViewChild is undefined.");
    }

    // Initialize Win Rate per Game Mode Chart
    if (this.winRatePerModeChart && this.winRatePerModeChart.nativeElement) {
      const ctxWinRatePerMode = this.winRatePerModeChart.nativeElement.getContext('2d');
      if (ctxWinRatePerMode) {
        const winRateModeLabels = Object.keys(this.gameStats.win_rate_per_mode);
        const winRateModeData = Object.values(this.gameStats.win_rate_per_mode);
        new Chart(ctxWinRatePerMode, {
          type: 'bar',
          data: {
            labels: winRateModeLabels,
            datasets: [{
              label: 'Win Rate (%)',
              data: winRateModeData,
              backgroundColor: '#9966FF'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: function(tickValue: string | number) {
                    return tickValue + '%';
                  }
                }
              }
            }
          }
        });
      } else {
        console.error("Cannot acquire context for winRatePerModeChart.");
      }
    } else {
      console.error("winRatePerModeChart ViewChild is undefined.");
    }

    // Initialize Scores Distribution Chart
    if (this.scoresDistributionChart && this.scoresDistributionChart.nativeElement) {
      const ctxScoresDistribution = this.scoresDistributionChart.nativeElement.getContext('2d');
      if (ctxScoresDistribution) {
        new Chart(ctxScoresDistribution, {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: 'Player 1 Scores',
                data: this.gameStats.scores_distribution.player1_scores.map((score: any) => ({ x: 1, y: score })),
                backgroundColor: '#36a2eb'
              },
              {
                label: 'Player 2 Scores',
                data: this.gameStats.scores_distribution.player2_scores.map((score: any) => ({ x: 2, y: score })),
                backgroundColor: '#ff6384'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                ticks: {
                  callback: function(tickValue: string | number) {
                    const value = Number(tickValue);
                    return value === 1 ? 'Player 1' : 'Player 2';
                  },
                  stepSize: 1,
                  minRotation: 0.5,
                  maxTicksLimit: 2
                },
                title: {
                  display: true,
                  text: 'Player'
                }
              },
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Score'
                }
              }
            }
          }
        });
      } else {
        console.error("Cannot acquire context for scoresDistributionChart.");
      }
    } else {
      console.error("scoresDistributionChart ViewChild is undefined.");
    }

    // Initialize Win Distribution per Game Mode Chart
    if (this.winDistributionPerModeChart && this.winDistributionPerModeChart.nativeElement) {
      const ctxWinDistributionPerMode = this.winDistributionPerModeChart.nativeElement.getContext('2d');
      if (ctxWinDistributionPerMode) {
        const winDistributionLabels = Object.keys(this.gameStats.win_distribution_per_mode);
        const winDistributionData = Object.values(this.gameStats.win_distribution_per_mode);
        new Chart(ctxWinDistributionPerMode, {
          type: 'bar',
          data: {
            labels: winDistributionLabels,
            datasets: [{
              label: 'Wins',
              data: winDistributionData,
              backgroundColor: '#ffcd56'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: {
                beginAtZero: true,
              }
            }
          }
        });
      } else {
        console.error("Cannot acquire context for winDistributionPerModeChart.");
      }
    } else {
      console.error("winDistributionPerModeChart ViewChild is undefined.");
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
