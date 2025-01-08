import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse
} from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import {
  catchError,
  filter,
  finalize,
  switchMap,
  take
} from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (req.url.includes('api.intra.42.fr')) {
      return next.handle(req);
    }
    
    // Clone the request to add the authentication token, if available
    let authReq = req;
    const accessToken = this.authService.getAccessToken();

    if (accessToken && !this.authService.jwtHelper.isTokenExpired(accessToken)) {
      authReq = this.addTokenToRequest(req, false);
    }

    // Handle the request
    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Check if error is due to unauthorized access
        if (error.status === 401 && error.error.message !== '2FA revalidation required') {
          return this.handle401Error(authReq, next);
        } else if (error.status === 401 && error.error.message === '2FA revalidation required') {
          this.authService.logout(error.error.message);
        } else if (error.status === 402 || error.status === 403) {
          this.authService.logout(error.error.message);
        }

        return throwError(() => error);
      })
    );
  }

  private addTokenToRequest(req: HttpRequest<any>, with_creds: boolean): HttpRequest<any> {
    let token = this.authService.getAccessToken();
    // console.debug('Adding token to request, token: ', token);
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      },
      withCredentials: with_creds,
    });
  }

  private handle401Error(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // If refreshTokenSubject has a value, a refresh is already in progress
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshTokenIfNeeded().pipe(
        switchMap((newToken: string | null) => {
          this.isRefreshing = false;

          if (newToken) {
            // console.log('Token refreshed successfully');
            // this.authService.setAccessToken(newToken);
            this.refreshTokenSubject.next(newToken);
            // Retry the failed request with the new token
            return next.handle(this.addTokenToRequest(req, false));
          } else {
            console.error('Failed to refresh token');
            // If we didn't get a new token, logout the user
            this.authService.logout('Failed to refresh token');
            return throwError(() => new Error('Failed to refresh token'));
          }
        }),
        catchError((err) => {
          console.error('Error refreshing token:', err);
          // If there's an error during refresh, logout the user
          this.isRefreshing = false;
          this.authService.logout('Failed to refresh token');
          return throwError(() => err);
        })
      );
    } else {
      // If refresh is in progress, queue the requests
      // console.log('Refresh token in progress, queuing request');
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap((token) => {
          // Retry the failed request with the new token
          return next.handle(this.addTokenToRequest(req, false));
        })
      );
    }
  }
}
