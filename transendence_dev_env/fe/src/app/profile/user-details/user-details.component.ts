// user-details.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Game, GameService } from 'src/app/games/game.service';
import { Tournament } from 'src/app/games/tournament/local/start/start.component';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { GameStats, StatsAnalyticsService, TournamentStats } from 'src/app/services/stats-analytics.service';

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss']
})
export class UserDetailsComponent implements OnInit {
  userId: number = 0;
  user: UserProfile | null = null;
  errorMessage: string = '';
  isLoading = true;

  gameHistory: Game[] = [];
  tournamentHistory: Tournament[] = [];

  activeTab: 'history' | 'ranking' = 'history';
  activeHistoryTab: 'games' | 'tournaments' = 'games';

  gameStats: GameStats = {
    username: '',
    total_wins: 0,
    total_games_played: 0,
    avg_score: 0,
    win_rank: 0,
    game_rank: 0,
    avg_score_rank: 0
  };
  
  tournamentStats: TournamentStats = {
    username: '',
    total_tournaments_won: 0,
    total_tournaments_participated: 0,
    win_rank: 0,
    participation_rank: 0
  };

  gameSearchName: string = '';
  gameStartDate: string | null = null;
  gameEndDate: string | null = null;
  gameSortOrder: 'asc' | 'desc' = 'desc';

  tournamentSearchName: string = '';
  tournamentStartDate: string | null = null;
  tournamentEndDate: string | null = null;
  tournamentSortOrder: 'asc' | 'desc' = 'desc';

  // Filtered lists for displaying results
  filteredGameHistory: Game[] = [];
  filteredTournamentHistory: Tournament[] = [];
    
  constructor(
    private route: ActivatedRoute,
    private profileService: ProfileService,
    private gameService: GameService,
    private statsAnalyticsService: StatsAnalyticsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.userId = +params.get('id')!;
      this.loadProfile(this.userId);
    });
  }

  loadProfile(userId: number) {
    this.isLoading = true;
  
    this.profileService.getUserDetails(userId).subscribe(
      (data) => {
        this.user = data;
        // Load game history, tournament history, and leaderboard
        this.loadUserStats(data.id);
      },
      (error) => {
        console.error('Error loading profile:', error);
        this.isLoading = false;
      }
    );
  }

  private loadUserStats(userId: number) {
    // Load game history
    this.gameService.getGamesByUser(userId).subscribe(
      (games) => { this.gameHistory = games; this.filteredGameHistory = games; },
      (error) => { console.warn('Error loading game history:', error); }
    );
  
    // Load tournament history
    this.gameService.getTournamentsByUser(userId).subscribe(
      (tournaments) => { this.tournamentHistory = tournaments; this.filteredTournamentHistory = tournaments; },
      (error) => { console.warn('Error loading tournament history:', error); }
    );
  
    // Load leaderboard game stats
    this.statsAnalyticsService.getGameLeaderboardByUser(userId).subscribe(
      (gameStats) => { this.gameStats = gameStats; },
      (error) => { console.warn('Error loading game leaderboard stats:', error); }
    );
  
    // Load leaderboard tournament stats
    this.statsAnalyticsService.getTournamentLeaderboardByUser(userId).subscribe(
      (tournamentStats) => { this.tournamentStats = tournamentStats; },
      (error) => { console.warn('Error loading tournament leaderboard stats:', error); }
    );
  
    // Set isLoading to false after all requests are complete
    this.isLoading = false;
  }
  getXpProgress(): number {
    if (!this.user) return 0;
    return Math.min((this.user.xp / this.user.xp_for_next_level) * 100, 100);
  }
  // Method to apply filters for game history
  applyGameFilters() {
    this.filteredGameHistory = this.gameHistory.filter(game => {
      return (
        (!this.gameSearchName || game.player1.username.includes(this.gameSearchName)) &&
        (!this.gameStartDate || (game.start_time && new Date(game.start_time) >= new Date(this.gameStartDate))) &&
        (!this.gameEndDate || (game.end_time && new Date(game.end_time) <= new Date(this.gameEndDate)))
      );
    });

    this.filteredGameHistory.sort((a, b) =>
      this.gameSortOrder === 'asc'
        ? new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        : new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
  }

  // Method to apply filters for tournament history
  applyTournamentFilters() {
    this.filteredTournamentHistory = this.tournamentHistory.filter(tournament => {
      return (
        (!this.tournamentSearchName || tournament.name.includes(this.tournamentSearchName)) &&
        (!this.tournamentStartDate || (tournament.start_time && new Date(tournament.start_time) >= new Date(this.tournamentStartDate))) &&
        (!this.tournamentEndDate || (tournament.end_time && new Date(tournament.end_time) <= new Date(this.tournamentEndDate)))
      );
    });

    this.filteredTournamentHistory.sort((a, b) =>
      this.tournamentSortOrder === 'asc'
        ? new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        : new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
    );
  }
}
