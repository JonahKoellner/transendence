import { Component, OnInit, OnDestroy, Renderer2, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Pong Arena';
  isDarkTheme = true;
  isCollapsed = true;
  isAuthenticated = false;
  is2FaEnabled = false;
  toldUser = false;
  showEasterEgg = false;

  private onGlobalMouseUpBound: (event: MouseEvent) => void;
  private routerSubscription!: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2,
    private profileService: ProfileService,
    private toastr: ToastrService,
    private ngZone: NgZone
  ) {
    this.applyTheme();
    // Bind the global mouseup handler once for attaching and detaching.
    this.onGlobalMouseUpBound = this.onGlobalMouseUp.bind(this);
  }

  ngOnInit(): void {
    // Subscribe to router events to detect navigation changes.
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkAuthentication();
    });

    // Initial authentication check.
    //this.checkAuthentication();

    // Start periodic token refresh if authenticated
    if (this.authService.isAuthenticated()) {
      this.authService.startPeriodicTokenRefresh();
    }

    // Attach the global mouseup listener outside Angular's zone for performance.
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mouseup', this.onGlobalMouseUpBound);
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from router events to prevent memory leaks
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

    // Remove the global mouseup listener
    document.removeEventListener('mouseup', this.onGlobalMouseUpBound);

    // Stop periodic token refresh
    this.authService.stopPeriodicTokenRefresh();
  }

  checkAuthentication(): void {
    if (this.authService.isAuthenticated()) {
      this.profileService.getProfile().subscribe(
        profile => {
          this.authService.initializeWebSocket();
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
    this.authService.logout("logout pressed");
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

  private onGlobalMouseUp(event: MouseEvent): void {
    // Filter out mouseup events originating from iframes.
    const targetElement = event.target as HTMLElement;
    if (targetElement.tagName === 'IFRAME') {
      return;
    }

    const selection = window.getSelection()?.toString().trim() || '';
    if (selection === 'end') {
      // Re-enter Angular's zone only when updating bound properties.
      this.ngZone.run(() => {
        this.showEasterEgg = true;
      });
    }
  }

  closeEasterEgg(): void {
    this.showEasterEgg = false;
  }
}
