import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { WebsocketService } from './services/websocket.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000';  // Your Django backend URL
  public jwtHelper = new JwtHelperService();

  constructor(private http: HttpClient, private router: Router, private websocketService: WebsocketService) {}

  // Register a new user
  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/accounts/register/`, { username, email, password }, { withCredentials: true });
  }

  // Login and store tokens
  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/accounts/login/`, { username, password }, { withCredentials: true }).pipe(
      tap((response: any) => {
        if (response.access) {
          this.storeTokens(response.access, response.refresh);
          this.websocketService.connectNotifications(response.access);
          // Check if otp_uri is present
          if (response.otp_uri) {
            // 2FA is not enabled yet, starting setup
            localStorage.setItem('otp_uri', response.otp_uri);  // Save OTP URI for QR code generation
            this.router.navigate(['/verify-otp']);  // Redirect to OTP setup and verification
          } else {
            // 2FA is enabled, proceed to home
            this.router.navigate(['/home']);
          }
        } else {
          console.error('Login failed: Access token not received');
          // Handle login failure (e.g., show an error message)
        }
      }),
      catchError(error => {
        console.error('Login error:', error);
        // Handle error (e.g., show an error message)
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
          localStorage.removeItem('otp_uri');  // Remove otp_uri after successful verification
          this.router.navigate(['/home']);  // Redirect to home after successful OTP
        } else {
          console.error('OTP verification failed');
        }
      })
    );
  }

  // Store the access token in local storage
  private storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  // Get the access token
  public getAccessToken(): string | null {
    const token = localStorage.getItem('access_token');
    console.log('Retrieved access token:', token);  // Debug log
    return token;
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    return token ? !this.jwtHelper.isTokenExpired(token) : false;
  }

  logout(): void {
    const accessToken = localStorage.getItem('access_token');

    if (accessToken) {
      const headers = { Authorization: `Bearer ${accessToken}` };

      this.http.post(`${this.apiUrl}/accounts/logout/`, {}, { headers }).subscribe(
        () => {
          // On success, clear local storage and navigate to the login page
          this.clearTokens();
          this.router.navigate(['/login']);
          this.websocketService.disconnect();
        },
        (error) => {
          console.error('Logout error:', error);
          this.clearTokens();  // Still clear tokens in case of an error
          this.router.navigate(['/login']);
          this.websocketService.disconnect();
        }
      );
    } else {
      this.clearTokens();
      this.router.navigate(['/login']);
      this.websocketService.disconnect();
    }
  }

  private clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('otp_verified');
    localStorage.removeItem('otp_uri');
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

  refreshTokenIfNeeded(): Observable<any> {
    const refreshToken = localStorage.getItem('refresh_token');
  
    if (!refreshToken) {
      console.error('Refresh token is missing, logging out');
      this.logout();
      return of(null);
    }
  
    return this.http.post(`${this.apiUrl}/accounts/token/refresh/`, { refresh: refreshToken }, { withCredentials: true }).pipe(
      tap((response: any) => {
        if (response && response.access) {
          console.log('Access token refreshed successfully', response.access);
          localStorage.setItem('access_token', response.access);
          this.websocketService.connectNotifications(response.access);
        } else {
          console.log('Refresh token failed, logging out');
          this.logout();
        }
      }),
      catchError(error => {
        console.error('Error refreshing token, logging out', error);
        this.logout();
        return of(null);
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
}
