// user-details.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { Game, GameService } from 'src/app/games/game.service';
import { Tournament } from 'src/app/games/tournament/local/start/start.component';
import { OnlineTournament } from 'src/app/games/tournament/online/online.component';
import { Achievement, ProfileService, UserProfile } from 'src/app/profile.service';
import { TournamentService } from 'src/app/services/tournament.service';

interface CombinedTournament {
  id: string | number;
  name: string;
  type: string;
  status: string;
  isOnline: boolean;
  start_time: string;
  end_time?: string | null;
}

export interface UserStats {
  games_played_over_time: { month: string; count: number }[];
  win_loss_ratio: { wins: number; losses: number };
  game_modes_distribution: { [mode: string]: number };
  time_spent_playing_over_time: { month: string; total_minutes: number }[];
  tournaments_stats: { participated: number; won: number };
  preferred_playing_times: { hour: string; count: number }[];
}

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss']
})
export class UserDetailsComponent implements OnInit, OnDestroy {
  userId: number = 0;
  private animationInterval: any;
  private animatedAngle: number = 0;
  user: UserProfile | null = null;
  errorMessage: string = '';
  isLoading = true;
  profileColor: any;
  gameHistory: Game[] = [];
  tournamentHistory: CombinedTournament[] = [];
  filteredTournamentHistory: CombinedTournament[] = [];
  userStats: any;
  profileBackgroundStyle: any;
  achievements: any;
  userAchievementIds: Set<number> = new Set<number>();
  activeTab: 'history' | 'stats' | 'graphs' | 'achievements' = 'history';
  activeHistoryTab: 'games' | 'tournaments' = 'games';

  gameSearchName: string = '';
  gameStartDate: string | null = null;
  gameEndDate: string | null = null;
  gameSortOrder: 'asc' | 'desc' = 'desc';

  tournamentSearchName: string = '';
  tournamentStartDate: string | null = null;
  tournamentEndDate: string | null = null;
  tournamentSortOrder: 'asc' | 'desc' = 'desc';

  filteredGameHistory: Game[] = [];
  pGames: number = 1;
  itemsPerPageGames: number = 5;

  pTournaments: number = 1;
  itemsPerPageTournaments: number = 5;

  chartData: UserStats | null = null;

  constructor(
    private route: ActivatedRoute,
    private profileService: ProfileService,
    private gameService: GameService,
    private toastr: ToastrService,
    private tournamentService: TournamentService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.userId = +params.get('id')!;
      this.loadProfile(this.userId);
    });
  }

  ngOnDestroy() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
  }

  onPageChangeProjects(page: number) {
    this.pGames = page;
  }

  onPageChangeTournaments(page: number) {
    this.pTournaments = page;
  }

  loadProfile(userId: number) {
    this.isLoading = true;

    this.profileService.getUserDetails(userId).subscribe(
      (data) => {
        this.user = data;
        this.loadUserStats(data.id);
        this.loadChartData(data.id);
      },
      (error) => {
        this.errorMessage = error;
        this.toastr.error('Failed to load profile. Please try again later.', 'Error');
        this.isLoading = false;
      }
    );
  }

  loadChartData(userId: number) {
    this.profileService.getUserStats(userId).subscribe(
      (data) => {
        this.chartData = data;
      },
      (error) => {
        console.error('Error loading user stats:', error);
      }
    );
  }

  private hexToRgba(hex: any, alpha: number): string {
    if (typeof hex !== 'string') {
      // console.error(`hexToRgba: Expected a string but received ${typeof hex}:`, hex);
      return `rgba(0, 0, 0, ${alpha})`;
    }

    let r = 0, g = 0, b = 0;
    hex = hex.replace(/^#/, '').trim();

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      // console.error(`Invalid hex color format: '${hex}'. Expected 3 or 6 characters.`);
      return `rgba(0, 0, 0, ${alpha})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private loadUserStats(userId: number) {
    forkJoin({
      profileColor: this.profileService.getProfileColorByProfileId(userId),
      games: this.gameService.getGamesByUser(userId),
      tournaments: this.gameService.getTournamentsByUser(userId),
      onlineTournaments: this.tournamentService.getTournamentsByUser(userId),
      userStats: this.gameService.getUserStats(userId),
      achievements: this.profileService.getAchievements()
    }).subscribe(
      ({ profileColor, games, tournaments, onlineTournaments, userStats, achievements }) => {
        this.profileColor = profileColor;
        this.profileBackgroundStyle = {
          'background': `linear-gradient(
            to bottom,
            rgba(30, 30, 30, 1) 0%,
            rgba(30, 30, 30, 0.8) 50%,
            ${this.hexToRgba(this.profileColor.profile_color, 0.5)} 100%
          )`,
          'filter': 'brightness(0.9)',
        };

        // Map offline tournaments to CombinedTournament
        const offlineMapped = tournaments.map((t: Tournament) => ({
          id: t.id ?? 0,
          name: t.name,
          type: t.type,
          status: t.status,
          isOnline: false,
          start_time: t.start_time instanceof Date 
            ? t.start_time.toISOString() 
            : new Date(t.start_time).toISOString(),
          end_time: t.end_time 
            ? (t.end_time instanceof Date 
                ? t.end_time.toISOString() 
                : new Date(t.end_time).toISOString())
            : null
        }));

        // Map online tournaments to CombinedTournament
        const onlineMapped = onlineTournaments.map((ot: OnlineTournament) => ({
          id: ot.id,
          name: ot.name,
          type: ot.type,
          status: ot.status,
          isOnline: true,
          start_time: ot.created_at,
          end_time: ot.end_time || null
        }));

        this.tournamentHistory = [...offlineMapped, ...onlineMapped];
        this.filteredTournamentHistory = [...this.tournamentHistory];

        this.gameHistory = games;
        this.filteredGameHistory = games;
        this.userStats = userStats;
        this.achievements = achievements;

        if (this.user && this.user.achievements) {
          this.userAchievementIds = new Set(this.user.achievements.map(a => a.id));
        }

        this.applyGameFilters();
        this.applyTournamentFilters();
        this.startBackgroundAnimation();
        this.isLoading = false;
      },
      (error: any) => {
        // console.warn('Error loading user stats:', error);
        this.isLoading = false;
      }
    );
  }

  getXpProgress(): number {
    if (!this.user) return 0;
    return Math.min((this.user.xp / this.user.xp_for_next_level) * 100, 100);
  }

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
    switch (achievement.name) {
      case 'First Win':
        return 'bi-trophy-fill';
      case 'Top Scorer':
        return 'bi-star-fill';
      case 'Blocker':
        return 'bi-shield-lock-fill';
      default:
        return 'bi-award-fill';
    }
  }

  private startBackgroundAnimation() {
    const baseSpeed = 0.5;
    const speedFactor = baseSpeed * (1 + (this.user!.level / 10));

    this.animationInterval = setInterval(() => {
      this.animatedAngle += speedFactor;
      if (this.animatedAngle >= 360) this.animatedAngle = 0;

      let gradientStops: string;
      if (this.user!.level < 5) {
        gradientStops = `
          rgba(30, 30, 30, 1) 0%,
          rgba(30, 30, 30, 0.8) 50%,
          ${this.hexToRgba(this.profileColor.profile_color, 0.5)} 100%
        `;
      } else if (this.user!.level < 10) {
        gradientStops = `
          rgba(30, 30, 30, 1) 0%,
          ${this.hexToRgba(this.profileColor.profile_color, 0.7)} 33%,
          ${this.hexToRgba(this.profileColor.profile_color, 0.5)} 66%,
          rgba(30, 30, 30, 0.8) 100%
        `;
      } else {
        gradientStops = `
          rgba(30, 30, 30, 1) 0%,
          ${this.hexToRgba(this.profileColor.profile_color, 0.9)} 25%,
          ${this.hexToRgba(this.profileColor.profile_color, 0.6)} 50%,
          ${this.hexToRgba(this.profileColor.profile_color, 0.9)} 75%,
          rgba(30, 30, 30, 0.8) 100%
        `;
      }

      const brightness = 0.9 + 0.1 * Math.sin(this.animatedAngle * (Math.PI / 180));

      this.profileBackgroundStyle = {
        'background': `linear-gradient(${this.animatedAngle}deg, ${gradientStops})`,
        'filter': `brightness(${brightness})`,
      };
    }, 50);
  }
}
