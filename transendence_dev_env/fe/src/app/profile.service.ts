import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
}
@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private apiUrl = 'http://localhost:8000/accounts/profile/'; // Adjust the URL accordingly

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiUrl);
  }

  updateProfile(data: FormData): Observable<any> {
    return this.http.put(this.apiUrl, data);
  }
}