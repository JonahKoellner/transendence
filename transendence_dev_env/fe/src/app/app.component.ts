import { Component, OnInit, Renderer2 } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  title = 'Pong Arena';
  isDarkTheme = true;
  isCollapsed = true;
  isAuthenticated = false;
  is2FaEnabled = false;
  toldUser = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2,
    private profileService: ProfileService,
    private toastr: ToastrService
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
          this.is2FaEnabled = profile.is_2fa_enabled;

          if (!this.is2FaEnabled && !this.toldUser && !this.router.url.startsWith('/verify-otp')) {
            this.toastr.info('You have not enabled 2FA. We recommend you enable it in your profile settings.', 'Info', { timeOut: 10000 });
            this.toldUser = true;
          }
          
          this.isAuthenticated = true;
        },
        error => {
          this.toastr.error('Failed to load profile. Please try again later.', 'Error');
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
