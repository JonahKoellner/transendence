import { Injectable, OnDestroy } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { delay, filter, retryWhen, tap } from 'rxjs/operators';
import { AuthService } from '../auth.service';

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
  public notifications$ = new Subject<any>();  // For notifications and chat messages
  private reconnectDelay: number = 5000;  // Reconnection delay in milliseconds
  private isConnected = new BehaviorSubject<boolean>(false);  // Observable to track connection status


  constructor(private authService: AuthService) {}  // Inject AuthService

  // Connect to WebSocket with token
  connectNotifications(token: string): void {
    this.socket$ = this.createWebSocket(token);

    this.socket$.pipe(
      retryWhen(errors =>
        errors.pipe(
          tap(err => console.error('WebSocket error, retrying...', err)),
          delay(this.reconnectDelay)  // Retry after a delay if WebSocket fails
        )
      )
    ).subscribe(
      msg => {
        this.isConnected.next(true);  // WebSocket is connected
        if (msg.event === 'chat_message') {
          this.notifications$.next(msg);  // Handle chat messages
        } else {
          this.notifications$.next(msg);  // Handle other notifications
        }
      },
      err => {
        console.error('WebSocket error:', err);
        this.isConnected.next(false);  // WebSocket is disconnected
      },
      () => {
        this.isConnected.next(false);  // WebSocket connection closed
        console.warn('WebSocket connection closed');
      }
    );
  }

  // Create WebSocket instance
  private createWebSocket(token: string): WebSocketSubject<any> {
    return webSocket({
      url: `ws://localhost:8000/ws/notifications/?token=${token}`,
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