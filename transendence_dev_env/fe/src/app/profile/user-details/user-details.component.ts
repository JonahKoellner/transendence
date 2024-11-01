// user-details.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Game, GameService } from 'src/app/games/game.service';
import { ProfileService, UserProfile } from 'src/app/profile.service';

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss']
})
export class UserDetailsComponent implements OnInit {
  userId: number = 0;
  user: UserProfile | null = null;
  games: Game[] = [];
  errorMessage: string = '';
  isLoading = true;
  constructor(
    private route: ActivatedRoute,
    private profileService: ProfileService,
    private gameService: GameService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.userId = +params.get('id')!;
      this.loadUserProfile(this.userId);
    });
  }

  loadUserProfile(userId: number): void {
    this.profileService.getUserDetails(userId).subscribe(
      (user) => {this.user = user; this.loadUserGames(userId);},
      (error) => {
        console.error('Failed to load user profile:', error);
        this.errorMessage = 'Could not load user profile.';
        this.isLoading = false;
      }
    );
  }

  loadUserGames(userId: number): void {
    this.gameService.getGamesByUser(userId).subscribe(
      (games) => {this.games = games; this.isLoading = false;},
      (error) => {
        console.error('Failed to load user games:', error);
        this.errorMessage = 'Could not load user games.';
        this.isLoading = false;
      }
    );
  }
  getXpProgress(): number {
    if (!this.user) return 0;
    return Math.min((this.user.xp / this.user.xp_for_next_level) * 100, 100);
  }
}
