import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProfileService } from 'src/app/profile.service';

@Component({
  selector: 'app-password-reset-confirm',
  templateUrl: './password-reset-confirm.component.html',
  styleUrls: ['./password-reset-confirm.component.scss']
})
export class PasswordResetConfirmComponent {
  uidb64: string = '';
  token: string = '';
  new_password: string = '';
  confirm_password: string = '';
  message: string = '';
  error: string = '';

  constructor(
    private route: ActivatedRoute,
    private authService: ProfileService,
    private router: Router
  ) {}

  ngOnInit() {
    this.uidb64 = this.route.snapshot.queryParamMap.get('uidb64') || '';
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }

  onSubmit() {
    if (this.new_password !== this.confirm_password) {
      this.error = "Passwords do not match.";
      this.message = '';
      return;
    }

    this.authService.confirmPasswordReset(this.uidb64, this.token, this.new_password).subscribe(
      (response) => {
        this.message = response.message;
        this.error = '';
        // Optionally redirect to login page after a delay
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      (error) => {
        this.error = error.error.non_field_errors || 'An error occurred.';
        this.message = '';
      }
    );
  }
}