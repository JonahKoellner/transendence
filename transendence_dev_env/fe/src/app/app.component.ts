import { AfterViewChecked, AfterViewInit, Component,OnInit,Renderer2, ViewChild  } from '@angular/core';
import { AuthService } from './auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { NotificationsComponent } from './notifications/notifications/notifications.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
  otpVerified: boolean = false;
  title = 'MyApp';
  isDarkTheme = true;
  isCollapsed = true;
  
  constructor(
    private authService: AuthService,
    private router: Router,
    private renderer: Renderer2
  ) {
    this.authService.initializeWebSocket();
    this.applyTheme();
  }

  ngOnInit(): void {
      console.log("------ Local Storage ------");
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
              console.log(`${key}: ${localStorage.getItem(key)}`);
          }
      }
  
      console.log("------ Cookies ------");
      const cookies = document.cookie.split(';');
      cookies.forEach(cookie => {
          const [name, value] = cookie.split('=');
          console.log(`${name.trim()}: ${decodeURIComponent(value)}`);
      });

      this.otpVerified = localStorage.getItem('otp_verified') === 'true';

      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.otpVerified = localStorage.getItem('otp_verified') === 'true';;
        }
      })
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