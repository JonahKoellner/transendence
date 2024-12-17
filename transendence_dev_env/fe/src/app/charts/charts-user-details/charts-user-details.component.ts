import { Component, Input, SimpleChanges } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { UserStats } from 'src/app/profile/user-details/user-details.component';

@Component({
  selector: 'app-charts-user-details',
  templateUrl: './charts-user-details.component.html',
  styleUrls: ['./charts-user-details.component.scss']
})
export class ChartsUserDetailsComponent {
  @Input() chartData!: UserStats;

  // 1. Games Played Over Time - Line Chart
  gamesPlayedLineChartData!: ChartConfiguration<'line'>['data'];
  gamesPlayedLineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // Add this line
    plugins: {
      title: {
        display: true,
        text: 'Games Played Over Time'
      }
    }
  };
  gamesPlayedLineChartType: 'line' = 'line'; // Changed type to explicit string

  // 2. Win/Loss Ratio - Pie Chart
  winLossPieChartData!: ChartConfiguration<'pie'>['data'];
  winLossPieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // Add this line
    plugins: {
      title: {
        display: true,
        text: 'Win/Loss Ratio'
      }
    }
  };
  winLossPieChartType: 'pie' = 'pie'; // Changed type to explicit string

  // 3. Game Modes Distribution - Bar Chart
  gameModesBarChartData!: ChartConfiguration<'bar'>['data'];
  gameModesBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // Add this line
    plugins: {
      title: {
        display: true,
        text: 'Game Modes Distribution'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };
  gameModesBarChartType: 'bar' = 'bar'; // Changed type to explicit string

  // 4. Time Spent Playing Over Time - Line Chart
  timeSpentLineChartData!: ChartConfiguration<'line'>['data'];
  timeSpentLineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // Add this line
    plugins: {
      title: {
        display: true,
        text: 'Time Spent Playing Over Time (Minutes)'
      }
    }
  };
  timeSpentLineChartType: 'line' = 'line'; // Changed type to explicit string

  // 5. Tournaments Stats - Doughnut Chart
  tournamentsDoughnutChartData!: ChartConfiguration<'doughnut'>['data'];
  tournamentsDoughnutChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // Add this line
    plugins: {
      title: {
        display: true,
        text: 'Tournaments Stats'
      }
    }
  };
  tournamentsDoughnutChartType: 'doughnut' = 'doughnut'; // Changed type to explicit string

  // 6. Preferred Playing Times - Bar Chart
  preferredTimesBarChartData!: ChartConfiguration<'bar'>['data'];
  preferredTimesBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false, // Add this line
    plugins: {
      title: {
        display: true,
        text: 'Preferred Playing Times'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };
  preferredTimesBarChartType: 'bar' = 'bar'; // Changed type to explicit string

  constructor() { }

  ngOnInit(): void {
    if (this.chartData) {
      this.initializeCharts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chartData'] && !changes['chartData'].isFirstChange()) { // Updated property name
      this.initializeCharts();
    }
  }

  initializeCharts(): void {
    // 1. Games Played Over Time - Line Chart
    this.gamesPlayedLineChartData = {
      labels: this.chartData.games_played_over_time.map(entry => entry.month),
      datasets: [
        {
          data: this.chartData.games_played_over_time.map(entry => entry.count),
          label: 'Games Played',
          fill: false,
          borderColor: 'blue',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.4
        }
      ]
    };

    // 2. Win/Loss Ratio - Pie Chart
    this.winLossPieChartData = {
      labels: ['Wins', 'Losses'],
      datasets: [
        {
          data: [this.chartData.win_loss_ratio.wins, this.chartData.win_loss_ratio.losses], // Changed 'userStats' to 'chartData'
          backgroundColor: ['#36A2EB', '#FF6384']
        }
      ]
    };

    // 3. Game Modes Distribution - Bar Chart
    this.gameModesBarChartData = {
      labels: Object.keys(this.chartData.game_modes_distribution),
      datasets: [
        {
          label: 'Game Modes',
          data: Object.values(this.chartData.game_modes_distribution),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }
      ]
    };

    // 4. Time Spent Playing Over Time - Line Chart
    this.timeSpentLineChartData = {
      labels: this.chartData.time_spent_playing_over_time.map(entry => entry.month),
      datasets: [
        {
          data: this.chartData.time_spent_playing_over_time.map(entry => entry.total_minutes),
          label: 'Total Minutes',
          fill: false,
          borderColor: 'green',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.4
        }
      ]
    };

    // 5. Tournaments Stats - Doughnut Chart
    this.tournamentsDoughnutChartData = {
      labels: ['Participated', 'Won'],
      datasets: [
        {
          data: [this.chartData.tournaments_stats.participated, this.chartData.tournaments_stats.won],
          backgroundColor: ['#FFCE56', '#4BC0C0']
        }
      ]
    };

    // 6. Preferred Playing Times - Bar Chart
    const filteredPreferredTimes = this.chartData.preferred_playing_times.filter(entry => entry.count > 0); // Optional filtering
    this.preferredTimesBarChartData = {
      labels: filteredPreferredTimes.map(entry => entry.hour),
      datasets: [
        {
          label: 'Plays',
          data: filteredPreferredTimes.map(entry => entry.count),
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }
      ]
    };
  }
}
