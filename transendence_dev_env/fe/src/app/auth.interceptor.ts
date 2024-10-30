import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshInProgress = false;
  private refreshTokenSubject: Subject<string | null> = new Subject<string | null>();

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const accessToken = this.authService.getAccessToken();

    if (accessToken && !this.authService.jwtHelper.isTokenExpired(accessToken)) {
      req = this.addTokenToRequest(req, accessToken);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Interceptor caught error:', error);

        // 401 error handling with refresh token logic
        if (error.status === 401 && localStorage.getItem('refresh_token')) {
          if (!this.refreshInProgress) {
            this.refreshInProgress = true;
            this.refreshTokenSubject.next(null); // Reset the subject for new refresh

            return this.authService.refreshTokenIfNeeded().pipe(
              switchMap((newAccessToken) => {
                this.refreshInProgress = false;
                if (newAccessToken) {
                  this.refreshTokenSubject.next(newAccessToken);
                  req = this.addTokenToRequest(req, newAccessToken);
                  return next.handle(req);
                } else {
                  this.authService.clearAll();
                  this.authService.logout();
                  return throwError('Failed to refresh token');
                }
              }),
              catchError((refreshError) => {
                this.refreshInProgress = false;
                this.authService.clearAll();
                this.authService.logout();
                return throwError(refreshError);
              })
            );
          } else {
            // Queue other requests during refresh process
            return this.refreshTokenSubject.pipe(
              filter((token) => token != null),
              take(1),
              switchMap((token) => {
                req = this.addTokenToRequest(req, token!);
                return next.handle(req);
              })
            );
          }
        }

        this.authService.clearAll();
        this.authService.logout();
        return throwError(error);
      })
    );
  }

  // Add token to request headers
  private addTokenToRequest(req: HttpRequest<any>, token: string): HttpRequest<any> {
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
}