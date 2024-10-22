import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const accessToken = this.authService.getAccessToken();
    console.log('Access token in interceptor:', accessToken);  // Debug log
  
    if (accessToken && !this.authService.jwtHelper.isTokenExpired(accessToken)) {
      req = this.addTokenToRequest(req, accessToken);
    }
  
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
      console.error('Interceptor caught error:', error);  // Debug log
      if (error.status === 401 && localStorage.getItem('refresh_token')) {
        return this.authService.refreshTokenIfNeeded().pipe(
          switchMap((response: any) => {
            console.log('Refresh token response:', response);  // Debug log
            if (response && response.access) {
              req = this.addTokenToRequest(req, response.access);
              return next.handle(req);
            }
            return throwError(error);
          }),
          catchError(err => {
            this.authService.logout();
            return throwError(err);
          })
        );
      }
  
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