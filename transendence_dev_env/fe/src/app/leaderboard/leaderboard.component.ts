// src/app/leaderboard/leaderboard.component.ts

import { Component, OnInit } from '@angular/core';
import { GameService, GlobalStats, LeaderboardEntry } from '../games/game.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {

  // Define properties to hold each leaderboard
  leaderboardXP: LeaderboardEntry[] = [];
  leaderboardMostWins: LeaderboardEntry[] = [];
  leaderboardMostGames: LeaderboardEntry[] = [];
  leaderboardMostTournamentWins: LeaderboardEntry[] = [];

  // Define property to hold global stats
  globalStats: GlobalStats | null = null;

  // Loading indicators
  isLoading: boolean = false;
  error: string | null = null;

  // Active Tab
  activeTab: 'leaderboards' | 'charts' = 'leaderboards';

  constructor(private gameService: GameService, private toastr: ToastrService) { }

  ngOnInit(): void {
    this.fetchGlobalStats();
  }

  /**
   * Fetch global statistics and extract leaderboards from the response.
   */
  fetchGlobalStats(): void {
    this.isLoading = true;
    this.error = null;

    this.gameService.getGlobalStats().subscribe({
      next: (data: GlobalStats) => {
        this.globalStats = data;

        // Extract leaderboards from global stats
        this.leaderboardXP = data.leaderboard_xp;
        this.leaderboardMostWins = data.leaderboard_most_wins;
        this.leaderboardMostGames = data.leaderboard_most_games;
        this.leaderboardMostTournamentWins = data.leaderboard_most_tournament_wins;

        this.isLoading = false;
      },
      error: (err: any) => {
        this.toastr.error('Failed to load global statistics. Please try again later.', 'Error');
        this.error = 'Failed to load global statistics. Please try again later.';
        this.isLoading = false;
      }
    });
  }

}
