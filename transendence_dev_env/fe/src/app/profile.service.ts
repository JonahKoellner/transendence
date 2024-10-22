import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Profile {
  display_name: string;
  avatar: string; // URL to the avatar image
  is_2fa_enabled: boolean;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  profile?: Profile; // Make profile optional if data is flattened
  display_name?: string; // Include these if your API response is flattened
  avatar?: string;
  is_online: boolean
}


@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private apiUrl = 'http://localhost:8000/accounts/users/'; // Adjust the URL accordingly
  private apiUrl2 = 'http://localhost:8000/accounts/profile/'; // Adjust the URL accordingly

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl2, { withCredentials: true });
  }

  updateProfile(data: FormData): Observable<any> {
    return this.http.put(this.apiUrl2, data, { withCredentials: true });
  }
  searchUsers(query: string): Observable<UserProfile[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<UserProfile[]>(`${this.apiUrl}search/`,  { params, withCredentials: true });
  }

  addFriend(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/add-friend/`, {}, { withCredentials: true });
  }

  removeFriend(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/remove-friend/`, {}, { withCredentials: true });
  }

  blockUser(userId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${userId}/block-user/`,{}, { withCredentials: true });
  }

  getUserDetails(userId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}${userId}/`, { withCredentials: true });
  }

  getCurrentUserId(): number {
    // Implement logic to retrieve the current user's ID, e.g., from JWT token
    // This is a placeholder
    return 1;
  }
  
}