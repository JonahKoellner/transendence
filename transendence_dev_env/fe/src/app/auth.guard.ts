import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    if (!this.authService.isAuthenticated() && !this.authService.refreshInProgress) {
      return this.authService.refreshTokenIfNeeded().pipe(
        map(token => {
          if (token) {
            return true; // Token was refreshed successfully
          } else {
            this.router.navigate(['/login']);
            return false; // Token refresh failed
          }
        }),
        catchError(() => {
          this.router.navigate(['/login']);
          return of(false);
        })
      );
    }

    return true; // User is already authenticated
  }
}
