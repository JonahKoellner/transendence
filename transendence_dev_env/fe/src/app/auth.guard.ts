import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    // Check if the user is authenticated (JWT token is valid)
    if (!this.authService.isAuthenticated()) {
      // console.log('Not authenticated, redirecting to /login');
      this.router.navigate(['/login']);
      return false;
    }

    // console.log('Access granted by AuthGuard');
    return true;
  }
  
}