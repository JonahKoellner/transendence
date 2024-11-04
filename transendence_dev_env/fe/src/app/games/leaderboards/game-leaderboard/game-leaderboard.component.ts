import { Component } from '@angular/core';
import { StatsAnalyticsService } from 'src/app/services/stats-analytics.service';

@Component({
  selector: 'app-game-leaderboard',
  templateUrl: './game-leaderboard.component.html',
  styleUrls: ['./game-leaderboard.component.scss']
})
export class GameLeaderboardComponent {
  gameLeaderboard: any;
  loading = true;
  error: string | null = null;

  constructor(private statsService: StatsAnalyticsService) {}

  ngOnInit(): void {
    this.statsService.getAllGameLeaderboard().subscribe({
      next: data => {
        this.gameLeaderboard = data;
        this.loading = false;
      },
      error: err => {
        this.error = 'Failed to load game leaderboard';
        this.loading = false;
      }
    });
  }
}
