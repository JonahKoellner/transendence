import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  is2FAEnabled: boolean = false;
  qrCodeImage: string = '';
  error: string = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Fetch the user's profile to check if 2FA is enabled
    this.authService.getProfile().subscribe(
      (profile) => {
        this.is2FAEnabled = profile.is_2fa_enabled;  // Update the UI based on the 2FA status
        const otpUri = localStorage.getItem('otp_uri');
        if (otpUri && this.is2FAEnabled) {
          this.generateQRCode(otpUri);  // Display QR code if 2FA is enabled and OTP URI is available
        }
      },
      (error) => {
        console.error('Error fetching profile:', error);
      }
    );
  }

  // Load user profile
  loadProfile(): void {
    this.authService.getProfile().subscribe(
      (profile) => {
        if (profile) {
          this.is2FAEnabled = profile.is_2fa_enabled;  // Update the 2FA status
        }
      },
      (error) => {
        console.error('Error loading profile', error);
      }
    );
  }

  // Enable 2FA and show QR code
  enable2FA() {
    this.authService.enable2FA().subscribe(
      (response) => {
        if (response && response.otp_uri) {
          alert('2FA enabled successfully');
          this.qrCodeImage = response.otp_uri;  // Store the QR code for display
        } else {
          this.error = 'Failed to enable 2FA';
        }
      },
      (error) => {
        console.error('Error enabling 2FA:', error);
        this.error = 'Error enabling 2FA. Please try again.';
      }
    );
  }

  // Disable 2FA
  disable2FA() {
    this.authService.disable2FA().subscribe(
      (response) => {
        if (response) {
          alert('2FA disabled successfully');
          this.qrCodeImage = '';  // Remove the QR code image
          this.is2FAEnabled = false;  // Update the status in UI
        } else {
          this.error = 'Failed to disable 2FA';
        }
      },
      (error) => {
        console.error('Error disabling 2FA:', error);
        this.error = 'Error disabling 2FA. Please try again.';
      }
    );
  }
  generateQRCode(otpUri: string) {
    QRCode.toDataURL(otpUri, (error: Error | null | undefined, url: string) => {
      if (error) {
        console.error('Error generating QR code', error);
      } else {
        this.qrCodeImage = url;
      }
    });
  }
}