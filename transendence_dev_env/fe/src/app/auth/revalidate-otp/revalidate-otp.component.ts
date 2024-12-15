import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';
import * as QRCode from 'qrcode';
import { NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-revalidate-otp',
  templateUrl: './revalidate-otp.component.html',
  styleUrls: ['./revalidate-otp.component.scss']
})
export class RevalidateOtpComponent {
  otp_code: string = '';
  error: string = '';
  isLoading: boolean = false;
  otp_uri: string = "";
  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute, private toastr: ToastrService) {}


  ngOnInit(): void {
    this.isLoading = true;
  }

  verifyOTP(form: NgForm) {
    if (form.invalid) {
      this.error = 'Please correct the errors in the form.';
      return;
    }
  
    this.isLoading = true;
    this.authService.verifyOTP(this.otp_code).subscribe(
      (response: any) => {
        if (response.success) {
          this.toastr.success('OTP verified successfully', 'Success');
          localStorage.setItem('otp_verified', 'true');
          this.isLoading = false;
          this.router.navigate(['/login']); // Navigate to the home page
        } else {
          this.error = response.message || 'Invalid OTP. Please try again.';
          this.isLoading = false;
        }
      },
      (error) => {
        this.isLoading = false;
        this.error = error.error?.message || 'OTP verification failed';
      }
    );
  }
}
