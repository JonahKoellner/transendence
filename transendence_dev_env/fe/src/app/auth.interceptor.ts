import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpInterceptor, HttpHandler,
  HttpRequest, HttpErrorResponse
} from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import {
  catchError, filter, switchMap, take
} from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip specific URLs that should not trigger a refresh
    if (
      req.url.includes('api.intra.42.fr') || 
      req.url.endsWith('/accounts/logout/') ||
      req.url.endsWith('/accounts/login/') ||
      req.url.endsWith('/accounts/register/') ||
      req.url.endsWith('/accounts/verify-otp/') ||
      req.url.endsWith('/accounts/token/refresh/')  // exclude refresh endpoint to avoid infinite loop
    ) {
      return next.handle(req);
    }

    // Always perform a refresh before proceeding with the request
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(newAccess => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(newAccess);
          const authReq = this.addTokenToRequest(req);
          return next.handle(authReq);
        }),
        catchError((err: HttpErrorResponse) => {
          this.isRefreshing = false;
          if (err.status !== 404) { //possible need to exclude more than just 404
            this.authService.logout('Token refresh failed');
          }
          return throwError(() => err);
        }),
      );
    } else {
      // If a refresh is already in progress, wait until it's done
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => {
          const authReq = this.addTokenToRequest(req);
          return next.handle(authReq);
        })
      );
    }
  }

  private addTokenToRequest(req: HttpRequest<any>): HttpRequest<any> {
    const token = this.authService.getAccessToken();
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }
}
