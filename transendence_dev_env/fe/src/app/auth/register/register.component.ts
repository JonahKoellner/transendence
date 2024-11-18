import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
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

  ngOnInit() {
    // Check if the user is already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/home']);
    }
  }

  register(form: NgForm) {
    if (form.invalid) {
      this.error = 'Please correct the errors in the form.';
      return;
    }

    this.authService.register(this.username, this.email, this.password).subscribe(
      () => {
        this.router.navigate(['/login'], { queryParams: { username: this.username, password: this.password } });
      },
      (error) => {
        this.error = 'Registration failed';
      }
    );
  }
}
