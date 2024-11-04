import { Component } from '@angular/core';
import { StatsAnalyticsService } from 'src/app/services/stats-analytics.service';

@Component({
  selector: 'app-tournament-leaderboard',
  templateUrl: './tournament-leaderboard.component.html',
  styleUrls: ['./tournament-leaderboard.component.scss']
})
export class TournamentLeaderboardComponent {
  tournamentLeaderboard: any;
  loading = true;
  error: string | null = null;

  constructor(private statsService: StatsAnalyticsService) {}

  ngOnInit(): void {
    this.statsService.getAllTournamentLeaderboard().subscribe({
      next: data => {
        this.tournamentLeaderboard = data;
        this.loading = false;
      },
      error: err => {
        this.error = 'Failed to load tournament leaderboard';
        this.loading = false;
      }
    });
  }
}
