import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    console.log('AuthGuard canActivate check');
  
    // Check if the user is authenticated (JWT token is valid)
    if (!this.authService.isAuthenticated()) {
      console.log('Not authenticated, redirecting to /login');
      this.router.navigate(['/login']);
      return false;
    }
  
    // Check if OTP verification is completed
    const otpVerified = localStorage.getItem('otp_verified') === 'true';
    console.log('OTP Verified:', otpVerified);
  
    // if (!otpVerified) {
    //   console.log('OTP not verified, redirecting to /verify-otp');
    //   this.router.navigate(['/verify-otp']);
    //   return false;
    // }
  
    console.log('Access granted by AuthGuard');
    return true;
  }
  
}