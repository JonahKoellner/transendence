import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshTokenSubject: Subject<string | null> = new Subject<string | null>();

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (req.url.includes('api.intra.42.fr')) {
      return next.handle(req);
    }

    const accessToken = this.authService.getAccessToken();

    if (accessToken && !this.authService.jwtHelper.isTokenExpired(accessToken)) {
      req = this.addTokenToRequest(req, accessToken);
    }

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Interceptor caught error:', error);

        // 401 error handling with refresh token logic
        if (error.status === 401 && error.error.message !== '2FA revalidation required') {
          if (!this.authService.refreshInProgress) {
            this.authService.refreshInProgress = true;
            this.refreshTokenSubject.next(null); // Reset the subject for new refresh

            return this.authService.refreshTokenIfNeeded().pipe(
              switchMap((newAccessToken) => {
                this.authService.refreshInProgress = false;
                if (newAccessToken) {
                  this.refreshTokenSubject.next(newAccessToken);
                  req = this.addTokenToRequest(req, newAccessToken);
                  return next.handle(req);
                } else {
                  this.authService.logout(error.error.message);
                  return throwError('Failed to refresh token');
                }
              }),
              catchError((refreshError) => {
                this.authService.refreshInProgress = false;
                this.authService.logout(error.error.message);
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
        } else {
          this.authService.logout(error.error.message);
        }

        return throwError(error);
      })
    );
  }

  private addTokenToRequest(req: HttpRequest<any>, token: string): HttpRequest<any> {

    if (req.url.includes('api.intra.42.fr')) {
      return req;
    }

    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      },
      withCredentials: true,
    });
  }
}