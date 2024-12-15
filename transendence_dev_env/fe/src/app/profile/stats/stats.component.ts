import { Component, OnInit } from '@angular/core';
import { GameService } from 'src/app/games/game.service';
import { Chart } from 'chart.js';



@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss']
})
export class StatsComponent implements OnInit {
  // userStats!: UserStats;

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    console.log("Stats loading...");
    // this.gameService.userGameStatistics().subscribe({
    //   next: (data: UserStats) => {
    //     this.userStats = data;
    //     this.initCharts(data);
    //     this.initExtendedCharts(data);
    //   },
    //   error: (error) => {

    //   }
    // });
  }

  // initCharts(data: UserStats) {
  //   // Total Games Played (PvE vs. PvP)
  //   new Chart('totalGamesChart', {
  //     type: 'doughnut',
  //     data: {
  //       labels: ['PvE', 'PvP'],
  //       datasets: [{
  //         data: [data.pve_games ?? 0, data.pvp_games ?? 0],
  //         backgroundColor: ['#ff6384', '#36a2eb']
  //       }]
  //     }
  //   });

  //   // Win Rate
  //   new Chart('winRateChart', {
  //     type: 'doughnut',
  //     data: {
  //       labels: ['Wins', 'Losses'],
  //       datasets: [{
  //         data: [data.win_rate ?? 0, 100 - (data.win_rate ?? 0)],
  //         backgroundColor: ['#61BA50', '#f44336']
  //       }]
  //     }
  //   });

  //   // Average Game Duration
  //   new Chart('averageDurationChart', {
  //     type: 'bar',
  //     data: {
  //       labels: ['Average Duration'],
  //       datasets: [{
  //         label: 'Seconds',
  //         data: [data.average_duration ?? 0],
  //         backgroundColor: ['#42a5f5']
  //       }]
  //     }
  //   });

  //   // Score Distribution (Check if data.scores exists)
  //   if (data.scores && Array.isArray(data.scores)) {
  //     new Chart('scoreDistributionChart', {
  //       type: 'line',
  //       data: {
  //         labels: Array.from({ length: data.scores.length }, (_, i) => i + 1),
  //         datasets: [{
  //           label: 'Score per Game',
  //           data: data.scores,
  //           borderColor: '#ffce56',
  //           fill: false
  //         }]
  //       }
  //     });
  //   } else {
  //     console.warn("No score data available for scoreDistributionChart.");
  //   }

  //   // Round-Wise Performance
  //   new Chart('roundPerformanceChart', {
  //     type: 'bar',
  //     data: {
  //       labels: ['Avg Rounds/Game', 'Avg Score/Round'],
  //       datasets: [{
  //         label: 'Rounds and Scores',
  //         data: [data.avg_rounds_per_game ?? 0, data.avg_score_per_round ?? 0],
  //         backgroundColor: ['#66bb6a', '#ffa726']
  //       }]
  //     }
  //   });
  // }

  // initExtendedCharts(data: UserStats) {
  //   // Monthly Performance
  //   new Chart('monthlyPerformanceChart', {
  //     type: 'bar',
  //     data: {
  //       labels: Object.keys(data.monthly_performance ?? {}),
  //       datasets: [{
  //         label: 'Games Played',
  //         data: Object.values(data.monthly_performance ?? {}).map((d) => d.games),
  //         backgroundColor: '#42a5f5'
  //       },
  //       {
  //         label: 'Win Rate',
  //         data: Object.values(data.monthly_performance ?? {}).map((d) => d.win_rate),
  //         backgroundColor: '#66bb6a'
  //       }]
  //     }
  //   });

  //   // Win Streaks
  //   new Chart('winStreakChart', {
  //     type: 'doughnut',
  //     data: {
  //       labels: ['Current Streak', 'Max Streak'],
  //       datasets: [{
  //         data: [data.current_win_streak ?? 0, data.max_win_streak ?? 0],
  //         backgroundColor: ['#42a5f5', '#ef5350']
  //       }]
  //     }
  //   });

  //   // First-Move Win Rate
  //   new Chart('firstMoveWinRateChart', {
  //     type: 'doughnut',
  //     data: {
  //       labels: ['First Move Wins', 'Other Wins'],
  //       datasets: [{
  //         data: [data.first_move_win_rate ?? 0, 100 - (data.first_move_win_rate ?? 0)],
  //         backgroundColor: ['#66bb6a', '#ff7043']
  //       }]
  //     }
  //   });

  //   // Performance by Time of Day
  //   new Chart('performanceByTimeChart', {
  //     type: 'line',
  //     data: {
  //       labels: Object.keys(data.performance_by_time ?? {}),
  //       datasets: [{
  //         label: 'Games Played',
  //         data: Object.values(data.performance_by_time ?? {}).map((d) => d.games),
  //         borderColor: '#42a5f5',
  //         fill: false
  //       },
  //       {
  //         label: 'Win Rate',
  //         data: Object.values(data.performance_by_time ?? {}).map((d) => d.win_rate),
  //         borderColor: '#66bb6a',
  //         fill: false
  //       }]
  //     }
  //   });
  // }
}
