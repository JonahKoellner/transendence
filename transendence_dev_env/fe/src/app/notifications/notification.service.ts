import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WebsocketService } from '../services/websocket.service';
import { Observable, BehaviorSubject } from 'rxjs';

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Notification {
  id: number;
  sender: User;
  receiver: User;
  notification_type: string;
  priority: string;
  timestamp: string;
  is_read: boolean;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:8000/accounts/notifications/';
  private notifications$ = new BehaviorSubject<Notification[]>([]);

  constructor(private http: HttpClient, private websocketService: WebsocketService) {
    this.receiveNotifications();  // Listen for new notifications via WebSocket
  }

  fetchNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.apiUrl, { withCredentials: true });
  }

  getNotifications(): Observable<Notification[]> {
    return this.notifications$.asObservable();
  }

  markAsRead(notificationId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${notificationId}/mark-as-read/`, {}, { withCredentials: true });
  }

  markAllAsRead(): Observable<any> {
    return this.http.post(`${this.apiUrl}mark-all-as-read/`, {}, { withCredentials: true });
  }

  updateNotifications(newNotifications: Notification[]): void {
    this.notifications$.next(newNotifications);
  }
  
  private receiveNotifications(): void {
    this.websocketService.notifications$.subscribe((notification: Notification) => {
      const currentNotifications = this.notifications$.value;
      this.notifications$.next([notification, ...currentNotifications]);
    });
  }
}