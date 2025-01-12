import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { WebsocketService } from './services/websocket.service';
import { environment } from 'src/environment';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // private apiUrl = 'http://localhost:8000';  // Your Django backend URL
  private apiUrl = environment.apiUrl;
  public jwtHelper = new JwtHelperService();
  public refreshInProgress = false;

  constructor(private http: HttpClient, private router: Router, private websocketService: WebsocketService, private toastr: ToastrService) {}

  // Register a new user
  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/accounts/register/`, { username, email, password }, { withCredentials: true });
  }

  // Login and store tokens
  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/accounts/login/`, { username, password }, { withCredentials: true }).pipe(
      tap((response: any) => {
        if (response.access && response.refresh) {
          this.storeTokens(response.access, response.refresh);
          if (response.otp_uri) localStorage.setItem('otp_uri', response.otp_uri);
          this.websocketService.connectNotifications(response.access);
        } else {
          console.error('Login failed: Access or refresh token not received');
        }
      }),
      catchError(error => {
        if (error.status === 400) {
          this.toastr.error('Invalid username or password', 'Login failed');
        } else if (error.status === 401) {
          localStorage.setItem('temp_token', error.error.access);
          this.toastr.warning('Please revalidate your OTP');
          this.router.navigate(['/revalidate-otp', { needToReVarify: true }]);
        }
        this.toastr.error('Login failed', 'Error');
        return of(null);
      })
    );
  }

  // Verify OTP and mark the 2FA as completed
  verifyOTP(otp_code: string): Observable<any> {
    const accessToken = localStorage.getItem('access_token') || localStorage.getItem('temp_token');
    if (!accessToken) throw new Error('Access token is missing');

    return this.http.post(`${this.apiUrl}/accounts/verify-otp/`, { otp_code }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).pipe(
      tap((response: any) => {
        if (response.success) {
          localStorage.setItem('otp_verified', 'true');
        } else {
          this.toastr.error('OTP verification failed', 'Error');
        }
      })
    );
  }

  // Store the access token in local storage
  private storeTokens(accessToken: string, refreshToken?: string): void {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) {  // this won't work because its a HttpOnly cookie!
      document.cookie = `refresh_token=${refreshToken}; path=/; SameSite=Lax; Secure=False`;
    }
  }

  // Get the access token
  public getAccessToken(): string | null {
    const token = localStorage.getItem('access_token');
    return token;
  }

  public setAccessToken(token: string): void {
    // Store the new access token
    localStorage.setItem('access_token', token);
  }

  // public getRefreshToken(): string | null {  this doesn't work!
  //   return this.getCookie('refresh_token');
  // }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    return token ? !this.jwtHelper.isTokenExpired(token) : false;
  }

  logout(reason?: string): void {
    let revalidate = false;
    if (reason === "2FA revalidation required") {
      revalidate = true;
    }
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      const headers = { Authorization: `Bearer ${accessToken}` };
      this.http.post(`${this.apiUrl}/accounts/logout/`, {}, { headers, withCredentials: true }).subscribe(
        (response) => {
          this.websocketService.disconnect();
          if (revalidate)
          {
            this.router.navigate(['/revalidate-otp', { needToReVarify: true }]);
          } else {
            this.router.navigate(['/login']);
            this.clearAll();
          }
        },
        (error) => {
          this.websocketService.disconnect();
          if (revalidate)
            {
              this.router.navigate(['/revalidate-otp', { needToReVarify: true }]);
            } else {
              this.router.navigate(['/login']);
              this.clearAll();
            }
        }
      );
    } else {
      this.websocketService.disconnect();
      if (revalidate)
        {
          this.router.navigate(['/revalidate-otp', { needToReVarify: true }]);
        } else {
          this.router.navigate(['/login']);
          this.clearAll();
        }
    }
  }


  public clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('otp_verified');
    localStorage.removeItem('otp_uri');
  }

  clearAll(): void {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    this.clearCookies();
  }

  private clearCookies(): void {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }

  refreshTokenIfNeeded(): Observable<string | null> {
    // console.debug('Refreshing JWT token...');
    // Prevent multiple refresh calls if a refresh is already in progress
    if (this.refreshInProgress) {  // could get triggered if we have two call one by Interceptor and one by AuthGuard
      console.error('Refresh token process already in progress');
      return of("");
      // return throwError('Refresh token process already in progress');
    }

    this.refreshInProgress = true;

    return this.http.post(`${this.apiUrl}/accounts/token/refresh/`, {}, { withCredentials: true }).pipe(
      tap((response: any) => {
        if (response && response.access) {
          // console.debug('Token refreshed successfully, new token: ', response.access);
          this.storeTokens(response.access);
          this.websocketService.connectNotifications(response.access);
          this.refreshInProgress = false; // idk maybe its useful
        } else {
          console.warn('Failed to refresh token, logging out');
          this.clearAll();
          this.logout();
        }
      }),
      catchError(error => {
        console.error('Error refreshing token, logging out:', error);
        this.clearAll();
        this.logout();
        return of(null);
      }),
      tap(() => {
        this.refreshInProgress = false; // Reset the refresh flag
      })
    );
  }

  // Method to retrieve user profile information
  getProfile(): Observable<any> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Access token is missing');
    }

    return this.http.get(`${this.apiUrl}/accounts/users/`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).pipe(
      tap((response: any) => {
        // console.log('Profile data retrieved:', response);  // Debug log
      }),
      catchError(err => {
        this.toastr.error('Failed to load profile data', 'Error');
        return of(null);  // Handle the error and return an observable
      })
    );
  }

  // Method to enable 2FA
  enable2FA(): Observable<any> {
    const accessToken = localStorage.getItem('access_token');  // Get JWT access token

    if (!accessToken) {
      throw new Error('Access token is missing');
    }

    return this.http.post(`${this.apiUrl}/accounts/enable-2fa/`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).pipe(
      tap((response: any) => {
        if (response.otp_uri) {
          localStorage.setItem('otp_uri', response.otp_uri);  // Store the OTP URI
        } else {
          console.error('No OTP URI returned');
        }
      }),
      catchError(err => {
        this.toastr.error('Failed to enable 2FA', 'Error');
        return of(null);  // Handle the error and return an observable
      })
    );
  }

  // Method to disable 2FA
  disable2FA(): Observable<any> {
    const accessToken = localStorage.getItem('access_token');  // Get JWT access token

    if (!accessToken) {
      throw new Error('Access token is missing');
    }

    return this.http.post(`${this.apiUrl}/accounts/disable-2fa/`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).pipe(
      tap((response: any) => {
        localStorage.removeItem('otp_uri');  // Remove the OTP URI from local storage
        localStorage.removeItem('otp_verified');  // Remove the OTP verified flag
      }),
      catchError(err => {
        this.toastr.error('Failed to disable 2FA', 'Error');
        return of(null);  // Handle the error and return an observable
      })
    );
  }
  initializeWebSocket(): void {
    const token = this.getAccessToken();
    if (token) {
        this.websocketService.connectNotifications(token);
    }
  }
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }
}
