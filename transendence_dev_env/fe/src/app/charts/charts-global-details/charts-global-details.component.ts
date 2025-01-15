// src/app/global-stats/charts-global-details/charts-global-details.component.ts

import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-charts-global-details',
  templateUrl: './charts-global-details.component.html',
  styleUrls: ['./charts-global-details.component.scss']
})
export class ChartsGlobalDetailsComponent implements OnInit, OnChanges {
  @Input() chartData!: any; // Define a more specific type if available

  // 1. Games Played per Mode - Bar Chart
  gamesPlayedPerModeBarChartData!: ChartConfiguration<'bar'>['data'];
  gamesPlayedPerModeBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Games Played per Mode'
      },
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Games'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Game Modes'
        }
      }
    }
  };
  gamesPlayedPerModeBarChartType: 'bar' = 'bar';

  // 2. Peak Playing Times - Bar Chart
  peakPlayingTimesBarChartData!: ChartConfiguration<'bar'>['data'];
  peakPlayingTimesBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Peak Playing Times'
      },
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Games Started'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Hour of the Day'
        }
      }
    }
  };
  peakPlayingTimesBarChartType: 'bar' = 'bar';

  // 3. Game Modes Popularity - Pie Chart
  gameModesPopularityPieChartData!: ChartConfiguration<'pie'>['data'];
  gameModesPopularityPieChartOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Game Modes Popularity (%)'
      },
      legend: {
        position: 'top'
      }
    }
  };
  gameModesPopularityPieChartType: 'pie' = 'pie';

  // 4. Games Played Globally Over Time - Line Chart
  gamesPlayedOverTimeLineChartData!: ChartConfiguration<'line'>['data'];
  gamesPlayedOverTimeLineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Games Played Globally Over Time (Last 12 Months)'
      },
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Games'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      }
    }
  };
  gamesPlayedOverTimeLineChartType: 'line' = 'line';

  // 5. Global Win/Loss Ratio - Stacked Bar Chart
  winLossRatioStackedBarChartData!: ChartConfiguration<'bar'>['data'];
  winLossRatioStackedBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Global Win/Loss Ratio'
      },
      tooltip: {
        mode: 'index',
        intersect: false
      },
      legend: {
        position: 'top'
      }
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Games'
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Games'
        }
      }
    }
  };
  winLossRatioStackedBarChartType: 'bar' = 'bar';

  // 6. Average Game Duration per Mode - Bar Chart
  avgGameDurationPerModeBarChartData!: ChartConfiguration<'bar'>['data'];
  avgGameDurationPerModeBarChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Average Game Duration per Mode (Seconds)'
      },
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Average Duration (Seconds)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Game Modes'
        }
      }
    }
  };
  avgGameDurationPerModeBarChartType: 'bar' = 'bar';

  constructor() { }

  ngOnInit(): void {
    console.log(this.chartData);
    if (this.chartData) {
      this.initializeCharts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chartData'] && !changes['chartData'].isFirstChange()) {
      this.initializeCharts();
    }
  }

  initializeCharts(): void {
    // 1. Games Played per Mode - Bar Chart
    this.gamesPlayedPerModeBarChartData = {
      labels: this.chartData.games_played_per_mode.labels,
      datasets: [
        {
          data: this.chartData.games_played_per_mode.data,
          label: 'Games Played',
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }
      ]
    };

    // 2. Peak Playing Times - Bar Chart
    this.peakPlayingTimesBarChartData = {
      labels: this.chartData.peak_playing_times.labels,
      datasets: [
        {
          data: this.chartData.peak_playing_times.data,
          label: 'Games Started',
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    };

    // 3. Game Modes Popularity - Pie Chart
    this.gameModesPopularityPieChartData = {
      labels: this.chartData.game_modes_popularity.labels,
      datasets: [
        {
          data: this.chartData.game_modes_popularity.data,
          backgroundColor: this.generateColorPalette(this.chartData.game_modes_popularity.data.length),
          borderColor: '#ffffff',
          borderWidth: 1
        }
      ]
    };

    // 4. Games Played Globally Over Time - Line Chart
    this.gamesPlayedOverTimeLineChartData = {
      labels: this.chartData.games_played_over_time.labels,
      datasets: [
        {
          data: this.chartData.games_played_over_time.data,
          label: 'Games Played',
          fill: true,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.4
        }
      ]
    };

    // 5. Global Win/Loss Ratio - Stacked Bar Chart
    this.winLossRatioStackedBarChartData = {
      labels: ['Games'],
      datasets: [
        {
          label: 'Wins',
          data: [this.chartData.win_loss_ratio.wins],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Losses',
          data: [this.chartData.win_loss_ratio.losses],
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    };

    // 6. Average Game Duration per Mode - Bar Chart
    this.avgGameDurationPerModeBarChartData = {
      labels: this.chartData.average_game_duration_per_mode.labels,
      datasets: [
        {
          data: this.chartData.average_game_duration_per_mode.data,
          label: 'Average Duration (s)',
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
          borderColor: 'rgba(255, 206, 86, 1)',
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Generates a color palette for pie charts based on the number of segments.
   * @param count Number of colors to generate.
   * @returns Array of RGBA color strings.
   */
  generateColorPalette(count: number): string[] {
    const colors: string[] = [];
    const predefinedColors = [
      'rgba(255, 99, 132, 0.6)',
      'rgba(54, 162, 235, 0.6)',
      'rgba(255, 206, 86, 0.6)',
      'rgba(75, 192, 192, 0.6)',
      'rgba(153, 102, 255, 0.6)',
      'rgba(255, 159, 64, 0.6)'
    ];

    for (let i = 0; i < count; i++) {
      colors.push(predefinedColors[i % predefinedColors.length]);
    }

    return colors;
  }
}
