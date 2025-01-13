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

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    if (req.url.includes('api.intra.42.fr')) {
      return next.handle(req);
    }

    if (req.url.endsWith('/accounts/logout/')) {
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
          console.error('Unauthorized access, logging out');
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

}
