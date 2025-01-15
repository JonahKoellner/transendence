// src/app/services/friend.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserProfile } from './profile.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FriendService {

  // private apiUrl = 'http://localhost:8000/accounts/users/';
  private apiUrl = environment.apiUrl + '/accounts/users/';

  constructor(private http: HttpClient) { }

  sendFriendRequest(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/send-friend-request/`, {}, { withCredentials: true });
  }

  removeFriend(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/remove-friend/`, {}, { withCredentials: true });
  }

  blockUser(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/block-user/`, {}, { withCredentials: true });
  }

  acceptFriendRequest(fromUserId: number): Observable<any> {
    const url = `${this.apiUrl}${fromUserId}/accept-request/`;
    return this.http.post(url, {}, { withCredentials: true });
  }

  rejectFriendRequest(fromUserId: number): Observable<any> {
    const url = `${this.apiUrl}${fromUserId}/reject-request/`;
    return this.http.post(url, {}, { withCredentials: true });
  }

  getFriends(): Observable<UserProfile[]> { // Explicit return type
    const url = `${this.apiUrl}friends/`;
    return this.http.get<UserProfile[]>(url, { withCredentials: true });
  }
  getFriendRequests(): Observable<any> {
    const url = `${this.apiUrl}friend-requests/`;
    return this.http.get(url, { withCredentials: true });
  }
  getBlockedUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.apiUrl}blocked-users/`, { withCredentials: true });
  }

  unblockUser(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/unblock-user/`, {}, { withCredentials: true });
  }
}
