import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private apiUrl = 'http://localhost:8000/accounts/notifications/';  // Adjust based on your backend

  constructor(private http: HttpClient) { }

  // Method to retrieve notifications
  getNotifications(): Observable<Notification[]> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Access token is missing');
    }

    return this.http.get<Notification[]>(this.apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).pipe(
      tap((response: Notification[]) => {
        console.log('Notifications retrieved:', response);  // Debug log
      }),
      catchError(err => {
        console.error('Error fetching notifications', err);
        return of([]);  // Handle the error and return an empty array
      })
    );
  }

  // Method to mark a notification as read
  markAsRead(notificationId: number): Observable<any> {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      throw new Error('Access token is missing');
    }

    return this.http.post(`${this.apiUrl}${notificationId}/mark-as-read/`, {}, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).pipe(
      tap((response: any) => {
        console.log('Notification marked as read:', response);  // Debug log
      }),
      catchError(err => {
        console.error('Error marking notification as read', err);
        return of(null);  // Handle the error and return an observable
      })
    );
  }
}