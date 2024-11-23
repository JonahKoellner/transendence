import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/auth.service';
import * as QRCode from 'qrcode';
import { NgForm } from '@angular/forms';

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
  otp_uri: string = "";
  constructor(private authService: AuthService, private router: Router, private route: ActivatedRoute) {}


  ngOnInit(): void {
    this.isLoading = true;
    this.route.paramMap.subscribe(params => {
      this.otp_uri = params.get('id')!;
      
      if (this.otp_uri) {
        this.showQRCode = true;
        this.generateQRCode(this.otp_uri);
      } else {
        const otpUri = localStorage.getItem('otp_uri');
        if (otpUri) {
          this.showQRCode = true;
          this.generateQRCode(otpUri);
        } else {
          this.showQRCode = false;
          //this.router.navigate(['/login']);
        }
      }
    });
  }

  generateQRCode(otpUri: string) {
    QRCode.toDataURL(otpUri, (error, url) => {
      if (!error) {
        this.qrCodeImage = url;
        this.isLoading = false;
      } else {
        console.error('Error generating QR code', error);
        this.isLoading = false;
      }
    });
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
          alert('OTP Verified Successfully');
          localStorage.setItem('otp_verified', 'true');
          // localStorage.removeItem('otp_uri'); // Remove otp_uri after successful verification
          this.router.navigate(['/home']); // Navigate to the home page
          this.isLoading = false;
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
