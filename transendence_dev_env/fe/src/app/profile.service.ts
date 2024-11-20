import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environment';

export interface Profile {
  display_name: string;
  avatar: string; // URL to the avatar image
  is_2fa_enabled: boolean;
}
export interface Achievement {
  id: number;
  name: string;
  description: string;
  points: number;
  is_earned?: boolean; // Indicates if the user has earned this achievement
  progress?: number;   // A value between 0 and 1 representing progress
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
  achievements?: Achievement[];
  paddleskin_color?: string;
  paddleskin_image?: string;
  ballskin_color?: string;
  ballskin_image?: string;
  gamebackground_color?: string;
  gamebackground_wallpaper?: string;
  is_2fa_enabled: boolean;
}


@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  // private apiUrl = 'http://localhost:8000/accounts/users/';
  private apiUrl = environment.apiUrl + '/accounts/users/';
  // private base = 'http://localhost:8000/accounts/';
  private base = environment.apiUrl + '/accounts/';
  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl, { withCredentials: true });
  }

  updateProfile(data: FormData, userId: number): Observable<any> {
    const url = `${this.apiUrl}${userId}/`;
    return this.http.put(url, data, { withCredentials: true });
  }
  searchUsers(query: string): Observable<UserProfile[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<UserProfile[]>(`${this.apiUrl}search/`,  { params, withCredentials: true });
  }

  getUserDetails(userId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}${userId}/`, { withCredentials: true });
  }

  getProfileColorByProfileId(userId: number): any {
    return this.http.get<any>(`${this.apiUrl}profile_color/${userId}/`, { withCredentials: true });
  }
  getAchievements(): Observable<any> {
    return this.http.get<any>(`${this.base}achievements/`, { withCredentials: true });
  }  
}