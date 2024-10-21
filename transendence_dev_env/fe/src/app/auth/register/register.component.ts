import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  username: string = '';
  email: string = '';
  password: string = '';
  error: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  register() {
    this.authService.register(this.username, this.email, this.password).subscribe(
      () => {
        this.router.navigate(['/login']);  // Redirect to login page after successful registration
      },
      (error) => {
        this.error = 'Registration failed';
      }
    );
  }
}