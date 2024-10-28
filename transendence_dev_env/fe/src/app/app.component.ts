import { AfterViewChecked, AfterViewInit, Component,Renderer2, ViewChild  } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { NotificationsComponent } from './notifications/notifications/notifications.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'MyApp';
  isDarkTheme = true;

  constructor(
    private authService: AuthService,
    private renderer: Renderer2
  ) {
    this.authService.initializeWebSocket();
    this.applyTheme();
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