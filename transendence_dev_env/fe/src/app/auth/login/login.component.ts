import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { AuthService } from 'src/app/auth.service';
import { ProfileService } from 'src/app/profile.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  error: string = '';

  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute, private profileService: ProfileService) {}

  ngOnInit() {
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

  login(form?: NgForm) {
    if (form && form.invalid) {
      this.error = 'Please correct the errors in the form.';
      return;
    }
  
    this.authService.login(this.username, this.password).subscribe(
      (response: any) => {
        localStorage.setItem('access_token', response.access);
        this.profileService.getProfile().subscribe(
          profile => {
            if (!profile.is_2fa_enabled && response.otp_uri) {
              this.router.navigate(['/verify-otp', response.otp_uri]);
            } else if (!profile.is_2fa_enabled && !response.otp_uri) {
              window.location.href = '/home';
            } else if (profile.is_2fa_enabled) {
              window.location.href = '/home';
            }
          },
          error => {
            console.error('Failed to load profile:', error);
          }
        );
      },
      (error) => {
        this.error = 'Invalid username or password';
      }
    );
  }
  
}
