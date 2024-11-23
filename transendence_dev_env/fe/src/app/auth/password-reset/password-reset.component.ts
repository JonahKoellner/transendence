import { Component } from '@angular/core';
import { AuthService } from 'src/app/auth.service';
import { ProfileService } from 'src/app/profile.service';

@Component({
  selector: 'app-password-reset',
  templateUrl: './password-reset.component.html',
  styleUrls: ['./password-reset.component.scss']
})
export class PasswordResetComponent {
  email: string = '';
  message: string = '';
  error: string = '';

  constructor(private authService: ProfileService) {}

  onSubmit() {
    this.authService.requestPasswordReset(this.email).subscribe(
      (response) => {
        this.message = response.message;
        this.error = '';
      },
      (error) => {
        this.error = error.error.email || error.error.non_field_errors || 'An error occurred.';
        this.message = '';
      }
    );
  }
}