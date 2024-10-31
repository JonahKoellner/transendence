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
  is_online: boolean;
  xp: number;          // Current XP
  level: number;       // Current level
  xp_for_next_level: number;  // XP required to reach the next level
}


@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private apiUrl = 'http://localhost:8000/accounts/users/'; // Adjust the URL accordingly
  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl, { withCredentials: true });
  }

  updateProfile(data: FormData): Observable<any> {
    return this.http.put(this.apiUrl, data, { withCredentials: true });
  }
  searchUsers(query: string): Observable<UserProfile[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<UserProfile[]>(`${this.apiUrl}search/`,  { params, withCredentials: true });
  }

  getUserDetails(userId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}${userId}/`, { withCredentials: true });
  }

  getCurrentUserId(): number {
    return 1;
  }
  
}