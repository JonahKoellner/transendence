import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';
import * as QRCode from 'qrcode';
@Component({
  selector: 'app-verify-otp',
  templateUrl: './verify-otp.component.html',
  styleUrls: ['./verify-otp.component.scss']
})
export class VerifyOtpComponent {
  otp_code: string = '';
  error: string = '';
  qrCodeImage: string = '';  // For storing the QR code image
  isLoading: boolean = false;
  showQRCode: boolean = false;  // Control whether to display QR code

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    const otpUri = localStorage.getItem('otp_uri');
    if (otpUri) {
      this.showQRCode = true;
      this.generateQRCode(otpUri);  // Generate QR code for first-time setup
    } else {
      this.showQRCode = false;
    }
  }

  generateQRCode(otpUri: string) {
    QRCode.toDataURL(otpUri, (error, url) => {
      if (!error) {
        this.qrCodeImage = url;
      } else {
        console.error('Error generating QR code', error);
      }
    });
  }

  verifyOTP() {
    this.isLoading = true;
    this.authService.verifyOTP(this.otp_code).subscribe(
      (response: any) => {
        this.isLoading = false;
        if (response.success) {
          alert('OTP Verified Successfully');
          localStorage.removeItem('otp_uri');  // Remove otp_uri after verification
          this.router.navigate(['/home']);  // Navigate to the home page
        } else {
          this.error = 'Invalid OTP. Please try again.';
        }
      },
      (error) => {
        this.isLoading = false;
        this.error = 'OTP verification failed';
      }
    );
  }
}