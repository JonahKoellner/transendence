// auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpInterceptor, HttpHandler,
  HttpRequest, HttpErrorResponse
} from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // 1) Bypass refresh for specific endpoints if needed:
    if (
      req.url.includes('api.intra.42.fr') ||
      req.url.endsWith('/accounts/logout/') ||
      req.url.endsWith('/accounts/login/') ||
      req.url.endsWith('/accounts/register/') ||
      req.url.endsWith('/accounts/token/refresh/')
    ) {
      return next.handle(req);
    }

    // 2) Attach the current token
    const authReq = this.addToken(req, this.authService.getAccessToken());
    
    // 3) Pass request along; if 401 arises, handle
    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Possibly expired token => refresh once
          return this.handle401Error(authReq, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(originalReq: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap((newToken: string) => {
          // Refresh succeeded
          this.isRefreshing = false;
          this.refreshTokenSubject.next(newToken);
          // Retry the original request w/ new token
          return next.handle(this.addToken(originalReq, newToken));
        }),
        catchError(err => {
          // Refresh failed => logout (deferred via setTimeout or Promise)
          this.isRefreshing = false;
          setTimeout(() => this.authService.logout('Token refresh failed'), 0);
          return throwError(() => err);
        })
      );
    } else {
      // If a refresh is already in progress, wait for it
      return this.refreshTokenSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(token => next.handle(this.addToken(originalReq, token!)))
      );
    }
  }

  private addToken(req: HttpRequest<any>, token: string | null): HttpRequest<any> {
    if (token) {
      return req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    return req;
  }
}
