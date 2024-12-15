import { Component } from '@angular/core';
import { AuthService } from '../auth.service';
import * as QRCode from 'qrcode';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  isLoading: boolean = false;
  is2FAEnabled: boolean = false;
  qrCodeImage: string = '';
  error: string = '';

  constructor(private authService: AuthService, private router: Router, private toastr: ToastrService) {}

  ngOnInit(): void {
    this.isLoading = true;
    // Fetch the user's profile to check if 2FA is enabled
    this.authService.getProfile().subscribe(
      (profile) => {
        this.is2FAEnabled = profile.is_2fa_enabled;  // Update the UI based on the 2FA status
        this.isLoading = false;
      },
      (error) => {
        this.error = 'Error fetching profile';
        this.toastr.error('Error fetching profile', 'Error');
        this.isLoading = false;
      }
    );
  }

  // Load user profile
  loadProfile(): void {
    this.isLoading = true;
    this.authService.getProfile().subscribe(
      (profile) => {
        if (profile) {
          this.is2FAEnabled = profile.is_2fa_enabled;  // Update the 2FA status
          this.isLoading = false;
        }
      },
      (error) => {
        this.error = 'Error loading profile. Please try again.';
        this.toastr.error('Error loading profile', 'Error');
        this.isLoading = false;
      }
    );
  }

  // Enable 2FA and show QR code
  enable2FA() {
    this.isLoading = true;
    this.authService.enable2FA().subscribe(
      (response) => {
        if (response && response.otp_uri) {
          this.router.navigate(['/verify-otp', response.otp_uri]);
        } else {
          this.toastr.error('Failed to enable 2FA', 'Error');
          this.error = 'Failed to enable 2FA';
          this.isLoading = false;
        }
      },
      (error) => {
        this.toastr.error('Error enabling 2FA', 'Error');
        this.error = 'Error enabling 2FA. Please try again.';
        this.isLoading = false;
      }
    );
  }

  // Disable 2FA
  disable2FA() {
    this.isLoading = true;
    this.authService.disable2FA().subscribe(
      (response) => {
        if (response) {
          localStorage.removeItem('otp_uri');
          this.toastr.success('2FA disabled successfully', 'Success');
          this.qrCodeImage = '';  // Remove the QR code image
          this.is2FAEnabled = false;  // Update the status in UI
          window.location.reload();  // Reload the page to reflect the changes
        } else {
          this.error = 'Failed to disable 2FA';
          this.toastr.error('Failed to disable 2FA', 'Error');
          this.isLoading = false;
        }
      },
      (error) => {
        this.toastr.error('Error disabling 2FA', 'Error');
        this.error = 'Error disabling 2FA. Please try again.';
        this.isLoading = false;
      }
    );
  }
}