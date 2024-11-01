import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WebsocketService } from '../services/websocket.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth.service';

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Notification {
  id: number;
  sender: {
    id: number;
    username: string;
    email: string;
  };
  receiver: {
    id: number;
    username: string;
    email: string;
  };
  notification_type: string;
  priority: string;
  timestamp: string;
  is_read: boolean;
  data?: any;
  friend_request_id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:8000/accounts/notifications/';
  private notifications$ = new BehaviorSubject<Notification[]>([]);

  constructor(
    private http: HttpClient,
    private websocketService: WebsocketService,
    private authService: AuthService
  ) {
    this.retrieveNotifications();  // Fetch initial notifications on service initialization
    this.receiveNotifications();   // Listen for new notifications via WebSocket
  }

  // Fetch historical notifications from the backend
  retrieveNotifications(): void {
    if (!this.authService.isAuthenticated()) return;
      this.fetchNotifications().subscribe(
        (notifications) => {
          this.notifications$.next(notifications);  // Populate initial notifications list
        },
        (error) => console.error('Error fetching notifications:', error)
      );
  }

  // Fetch notifications from the backend API
  fetchNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.apiUrl, { withCredentials: true });
  }

  getNotifications(): Observable<Notification[]> {
    return this.notifications$.asObservable();
  }

  // Mark a specific notification as read
  markAsRead(notificationId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${notificationId}/mark-as-read/`, {}, { withCredentials: true });
  }

  // Mark all notifications as read
  markAllAsRead(): Observable<any> {
    return this.http.post(`${this.apiUrl}mark-all-as-read/`, {}, { withCredentials: true });
  }

  // Listen for new notifications from WebSocket
  private receiveNotifications(): void {
    if (!this.authService.isAuthenticated()) return;
    this.websocketService.notifications$.subscribe((notification: Notification) => {
      const currentNotifications = this.notifications$.value;
      this.notifications$.next([notification, ...currentNotifications]);
    });
  }
}