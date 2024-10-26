import { Component } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'fe';
  constructor(private authService: AuthService, private router: Router) {
    this.authService.initializeWebSocket();
  }

  logout(): void {
    this.authService.logout()
  }
}
