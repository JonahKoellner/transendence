import { Component, OnInit, Renderer2 } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  title = 'MyApp';
  isDarkTheme = true;
  isCollapsed = true;
  isAuthenticated = false;
  is2FaEnabled = false;
  toldUser = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2,
    private profileService: ProfileService
  ) {
    this.authService.initializeWebSocket();
    this.applyTheme();
  }

  ngOnInit(): void {
    // Subscribe to router events to detect navigation changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkAuthentication();
    });

    // Initial authentication check
    this.checkAuthentication();
  }

  checkAuthentication(): void {
    if (this.authService.isAuthenticated()) {
      this.profileService.getProfile().subscribe(
        profile => {
          console.log("Profile main: ", profile);
          this.is2FaEnabled = profile.is_2fa_enabled;

          if (!this.is2FaEnabled && !this.toldUser && !this.router.url.startsWith('/verify-otp')) {
            const userChoice = confirm(
              "You have not enabled 2FA. We recommend you enable it in your profile settings. Do you want to enable it now?"
            );
            this.toldUser = true;
            if (userChoice) {
              this.router.navigate(['/profile']);
            }
          }
          
          this.isAuthenticated = true;
        },
        error => {
          console.error('Failed to load profile:', error);
          this.isAuthenticated = false;
          this.router.navigate(['/login']);
        }
      );
    } else {
      this.isAuthenticated = false;
    }
  }

  logout(): void {
    this.authService.logout();
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    this.applyTheme();
  }

  applyTheme(): void {
    if (this.isDarkTheme) {
      this.renderer.addClass(document.body, 'dark-theme');
    } else {
      this.renderer.removeClass(document.body, 'dark-theme');
    }
  }
}
