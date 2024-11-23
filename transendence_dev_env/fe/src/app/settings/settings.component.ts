import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import * as QRCode from 'qrcode';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  is2FAEnabled: boolean = false;
  qrCodeImage: string = '';
  error: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Fetch the user's profile to check if 2FA is enabled
    this.authService.getProfile().subscribe(
      (profile) => {
        this.is2FAEnabled = profile.is_2fa_enabled;  // Update the UI based on the 2FA status
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
          this.router.navigate(['/verify-otp', response.otp_uri]);
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
          localStorage.removeItem('otp_uri');
          alert('2FA disabled successfully');
          this.qrCodeImage = '';  // Remove the QR code image
          this.is2FAEnabled = false;  // Update the status in UI
          window.location.reload();  // Reload the page to reflect the changes
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
}