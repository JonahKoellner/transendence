import { Injectable, OnDestroy } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { delay, filter, retryWhen, tap } from 'rxjs/operators';
import { AuthService } from '../auth.service';
import { environment } from 'src/environment';

interface Notification {
  id: number;
  sender: {
    id: number;
    username: string;
    email: string;
  };
  notification_type: string;
  priority: string;
  timestamp: string;
  is_read: boolean;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketService implements OnDestroy {
  private socket$!: WebSocketSubject<any>;
  private apiUrl = environment.apiUrl;
  public notifications$ = new Subject<any>();  // For notifications and chat messages
  private reconnectDelay: number = 1000;  // Reconnection delay in milliseconds
  private isConnected = new BehaviorSubject<boolean>(false);  // Observable to track connection status


  constructor(private auth: AuthService) {}  // Inject AuthService

  connectNotifications(token: string): void {
    // If there's an existing connection, return to avoid reconnecting
    if (this.isConnected.value) return;
  
    this.socket$ = this.createWebSocket(token);
  
    this.socket$.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(err => {
            console.error('WebSocket error, retrying...', err);
          }),
          // Delay before retry
          delay(this.reconnectDelay),
          // Refresh token if needed
          switchMap(() => this.auth.refreshTokenIfNeeded().pipe(
            tap((newToken: string | null) => {
              if (!newToken) {
                // Handle the case where the token is null
                console.error('No token returned; cannot reconnect.');
                throw new Error('No token to use for WebSocket connection');
              }
              console.log('Retrying with new token:', newToken);
              // Now guaranteed to be a string, so no more TS error:
              this.socket$ = this.createWebSocket(newToken);
            })
          )),
          // Retry with the new token
          switchMap(() => this.socket$)
        )
      )
    ).subscribe({
      next: msg => {
        if (!this.isConnected.value) {
          this.isConnected.next(true);
        }
        this.notifications$.next(msg);
      },
      error: err => {
        console.error('WebSocket error:', err);
        this.isConnected.next(false);
      },
      complete: () => {
        this.isConnected.next(false);
        console.warn('WebSocket connection closed');
      }
    });
  }

  // Create WebSocket instance
  private createWebSocket(token: string): WebSocketSubject<any> {
    return webSocket({
      // url: `ws://localhost:8000/ws/notifications/?token=${token}`,
      url: environment.wsUrl + `/notifications/?token=${token}`,
      deserializer: msg => JSON.parse(msg.data),
      serializer: msg => JSON.stringify(msg)
    });
  }

  // Send a message via WebSocket
  sendMessage(msg: any): void {
    this.isConnected.pipe(tap(connected => {
      if (connected) {
        this.socket$.next(msg);
      } else {
        console.error('WebSocket is not connected, cannot send message.');
      }
    })).subscribe();
  }

  // Get a new token
  // private getNewToken(): Observable<string> {
  //   return this.http.post(`${this.apiUrl}/accounts/token/refresh/`, {}, { withCredentials: true }).pipe(
  //     map((response: any) => {
  //       if (response && response.access) {
  //         localStorage.setItem('access_token', response.access);
  //         return response.access;
  //       } else {
  //         console.warn('ws: Failed to refresh token, logging out');
  //         return '';  // Return an empty string or handle the error appropriately
  //       }
  //     }),
  //     catchError(error => {
  //       console.error('ws err: Error refreshing token, logging out:', error);
  //       return new Observable<string>();  // Return an empty observable or handle the error appropriately
  //     })
  //   );
  // }

  // Return an observable that resolves when WebSocket is connected
  waitForConnection(): Observable<boolean> {
    return this.isConnected.asObservable();
  }

  // Disconnect from WebSocket
  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
    }
    this.isConnected.next(false);
  }

  ngOnDestroy() {
    this.disconnect();
  }
}