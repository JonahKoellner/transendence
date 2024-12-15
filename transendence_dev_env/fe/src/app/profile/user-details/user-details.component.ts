// user-details.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { Game, GameService } from 'src/app/games/game.service';
import { Tournament } from 'src/app/games/tournament/local/start/start.component';
import { Achievement, ProfileService, UserProfile } from 'src/app/profile.service';

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
  profileColor: any;
  gameHistory: Game[] = [];
  tournamentHistory: Tournament[] = [];
  userStats: any;
  profileBackgroundStyle: any;
  achievements: any;
  userAchievementIds: Set<number> = new Set<number>();
  activeTab: 'history' | 'stats' | 'graphs' | 'achievements'= 'history';
  activeHistoryTab: 'games' | 'tournaments' = 'games';

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
    private toastr: ToastrService
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
        this.errorMessage = error;
        this.toastr.error('Failed to load profile. Please try again later.', 'Error');
        this.isLoading = false;
      }
    );
  }

  private hexToRgba(hex: any, alpha: number): string {
    if (typeof hex !== 'string') {
      console.error(`hexToRgba: Expected a string but received ${typeof hex}:`, hex);
      return `rgba(0, 0, 0, ${alpha})`; // Fallback to black with the given alpha
    }
  
    let r = 0, g = 0, b = 0;
  
    // Normalize the hex string: remove '#' and trim whitespace
    hex = hex.replace(/^#/, '').trim();
  
    if (hex.length === 3) {
      // Expand shorthand form (e.g., 'f3d') to full form ('ff33dd')
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      console.error(`Invalid hex color format: '${hex}'. Expected 3 or 6 characters.`);
      return `rgba(0, 0, 0, ${alpha})`; // Fallback to black with the given alpha
    }
  
    console.log(`Converted Hex: #${hex} to RGBA: rgba(${r}, ${g}, ${b}, ${alpha})`);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private loadUserStats(userId: number) {
    forkJoin({
      profileColor: this.profileService.getProfileColorByProfileId(userId),
      games: this.gameService.getGamesByUser(userId),
      tournaments: this.gameService.getTournamentsByUser(userId),
      userStats: this.gameService.getUserStats(userId),
      achievements: this.profileService.getAchievements()
    }).subscribe(
      ({ profileColor, games, tournaments, userStats, achievements }) => {
        this.profileColor = profileColor; // e.g., "#d4cfcb"
        // Compute the gradient background
        this.profileBackgroundStyle = {
          'background': `linear-gradient(
            to bottom,
            rgba(30, 30, 30, 1) 0%,
            rgba(30, 30, 30, 0.8) 50%,
            ${this.hexToRgba(this.profileColor.profile_color, 0.5)} 100%
          )`,
          'filter': 'brightness(0.9)',
        };

        this.gameHistory = games;
        this.filteredGameHistory = games;

        this.tournamentHistory = tournaments;
        this.filteredTournamentHistory = tournaments;

        this.userStats = userStats;
        this.achievements = achievements;
        if (this.user && this.user.achievements) {
          this.userAchievementIds = new Set(this.user.achievements.map(a => a.id));
        }
        this.applyGameFilters();
        this.applyTournamentFilters();
        this.isLoading = false;

      },
      (error: any) => {
        console.warn('Error loading user stats:', error);
        this.isLoading = false;
      }
    );
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
    this.filteredGameHistory = this.filteredGameHistory.filter(game => game.is_completed === true);
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
    this.filteredTournamentHistory = this.filteredTournamentHistory.filter(tournament => tournament.status === 'completed');
  }
  getAchievementIconClass(achievement: Achievement): string {
    // Map achievement names or IDs to Bootstrap icon classes
    switch (achievement.name) {
      case 'First Win':
        return 'bi-trophy-fill';
      case 'Top Scorer':
        return 'bi-star-fill';
      case 'Blocker':
        return 'bi-shield-lock-fill';
      // Add cases for other achievements
      default:
        return 'bi-award-fill'; // Default icon
    }
  }
}
