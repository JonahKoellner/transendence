import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';
import { Game } from 'src/app/games/game.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {

  recentGames: Game[] = [];

  constructor(private authService: AuthService, private router: Router) {}

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  navigateToMode(mode: string) {
    switch (mode) {
      case 'pve':
        this.router.navigate(['/games/local-pve']);
        break;
      case 'local_pvp':
        this.router.navigate(['/games/local-pvp']);
        break;
      case 'online_pvp':
        this.router.navigate(['/games/online-pvp']);
        break;
      case 'tournament': 
        this.router.navigate(['/games/tournament/local/start']);
        break;
      case 'arena':
        this.router.navigate(['/games']);
        break;
    }
  }
  navigateToLeaderboards() {
    this.router.navigate(['/leaderboards']);
  }
  navigateToGameSelection() {
    this.router.navigate(['/games']);
  }
}