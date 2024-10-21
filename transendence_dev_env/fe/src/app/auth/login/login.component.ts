import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit{
  username: string = '';
  password: string = '';
  error: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit()
  {
    // Check if the user is already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
  }

  login() {
    this.authService.login(this.username, this.password).subscribe(
      (response: any) => {
        localStorage.setItem('access_token', response.access);
        this.router.navigate(['/verify-otp']);  // Redirect to OTP verification
      },
      (error) => {
        this.error = 'Invalid username or password';
      }
    );
  }
}