import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { WebsocketService } from './services/websocket.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000';  // Your Django backend URL
  public jwtHelper = new JwtHelperService();
  public refreshInProgress = false;
  
  constructor(private http: HttpClient, private router: Router, private websocketService: WebsocketService) {}

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
          localStorage.setItem('otp_uri', response.otp_uri);
          this.websocketService.connectNotifications(response.access);
        } else {
          console.error('Login failed: Access or refresh token not received');
        }
      }),
      catchError(error => {
        console.error('Login error:', error);
        return of(null);
      })
    );
  }

  // Verify OTP and mark the 2FA as completed
  verifyOTP(otp_code: string): Observable<any> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) throw new Error('Access token is missing');
  
    return this.http.post(`${this.apiUrl}/accounts/verify-otp/`, { otp_code }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).pipe(
      tap((response: any) => {
        if (response.success) {
          localStorage.setItem('otp_verified', 'true');
        } else {
          console.error('OTP verification failed');
        }
      })
    );
  }

  // Store the access token in local storage
  private storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('access_token', accessToken);
    document.cookie = `refresh_token=${refreshToken}; path=/; SameSite=Lax; Secure=False`;
    console.log('Access token stored:', accessToken);  // Debug log
    console.log('Refresh token stored:', refreshToken);  // Debug log
    console.log('Cookies:', document.cookie);  // Debug log
    console.log('Via getCookie:', this.getRefreshToken());  // Debug log
  }

  // Get the access token
  public getAccessToken(): string | null {
    const token = localStorage.getItem('access_token');
    console.log('Retrieved access token:', token);  // Debug log
    return token;
  }
  public getRefreshToken(): string | null {
    return this.getCookie('refresh_token');
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    return token ? !this.jwtHelper.isTokenExpired(token) : false;
  }

  logout(): void {
    const accessToken = localStorage.getItem('access_token');
    console.log('Attempting to logout. Access token:', accessToken);

    if (accessToken) {
      const headers = { Authorization: `Bearer ${accessToken}` };
      this.http.post(`${this.apiUrl}/accounts/logout/`, {}, { headers, withCredentials: true }).subscribe(
        (response) => {
          console.log('Logout successful. Response:', response);
          this.clearAll();
          this.websocketService.disconnect();
          window.location.href = '/login';
        },
        (error) => {
          console.error('Logout error:', error);
          this.clearAll();
          this.websocketService.disconnect();
          window.location.href = '/login';
        }
      );
    } else {
      this.clearAll();
      this.websocketService.disconnect();
      window.location.href = '/login';
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


  // Handle redirection after login based on authentication state
  handleAuthNavigation() {
    if (this.isAuthenticated()) {
      const otpVerified = localStorage.getItem('otp_verified') === 'true';
      if (!otpVerified) {
        this.router.navigate(['/verify-otp']);  // Redirect to OTP verification if not completed
      } else {
        this.router.navigate(['/home']);  // Redirect to home if authenticated and verified
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  refreshTokenIfNeeded(): Observable<string | null> {
    const refreshToken = this.getCookie('refresh_token');

    if (!refreshToken) {
      console.warn('Refresh token is missing. Logging out...');
      this.clearAll();
      this.logout();
      return of(null);
    }
    console.log("Refreshing with rf token: ",refreshToken)
    // Prevent multiple refresh calls if a refresh is already in progress
    if (this.refreshInProgress) {
      return throwError('Refresh token process already in progress');
    }

    this.refreshInProgress = true;

    return this.http.post(`${this.apiUrl}/accounts/token/refresh/`, { refresh: refreshToken }, { withCredentials: true }).pipe(
      tap((response: any) => {
        if (response && response.access) {
          this.storeTokens(response.access, response.refresh || refreshToken);
          this.websocketService.connectNotifications(response.access);
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
        console.log('Profile data retrieved:', response);  // Debug log
      }),
      catchError(err => {
        console.error('Error fetching profile data', err);
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
        console.error('Error enabling 2FA', err);
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
        console.log('2FA disabled:', response.message);
        localStorage.removeItem('otp_uri');  // Remove the OTP URI from local storage
        localStorage.removeItem('otp_verified');  // Remove the OTP verified flag
      }),
      catchError(err => {
        console.error('Error disabling 2FA', err);
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
