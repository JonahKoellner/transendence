import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';
import { ProfileService } from 'src/app/profile.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit{
  username: string = '';
  password: string = '';
  error: string = '';

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute, private profileService: ProfileService) {}

  ngOnInit()
  {
    // Check if the user is already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
        this.route.queryParams.subscribe(params => {
          this.username = params['username'];
          this.password = params['password'];
          if (this.username && this.password) this.login();
        });
  }

  login() {
    this.authService.login(this.username, this.password).subscribe(
      (response: any) => {
        localStorage.setItem('access_token', response.access);
        this.profileService.getProfile().subscribe(
          profile => {
            console.log('Profile in login:', profile);
            if (!profile.is_2fa_enabled) {  // Check if 2FA is enabled
              console.log('2FA not enabled');
              this.router.navigate(['/verify-otp', response.otp_uri]);
            } else {
              this.router.navigate(['/home']);  // Navigate to home
            }
          },
          error => {
              console.error('Failed to load profile:', error);
              this.router.navigate(['/login']);
          });
      },
      (error) => {
        this.error = 'Invalid username or password';
      }
    );
  }
  
}