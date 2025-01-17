import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    if (this.authService.isAuthenticated()) {
      return of(true);
    }
  
    return this.authService.refreshToken().pipe(
      map(() => true),
      catchError(err => {
        // console.error('Route guard: Token refresh failed', err);
        this.router.navigate(['/login'], { queryParams: { message: 'Session expired, please log in again' } });
        return of(false);
      })
    );
  }
}
