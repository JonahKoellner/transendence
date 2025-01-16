// ft-auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
export interface FtUser {
  id: number
  email: string
  login: string
  first_name: string
  last_name: string
  usual_full_name: string
  usual_first_name: any
  url: string
  phone: string
  displayname: string
  kind: string
  image: Image
  "staff?": boolean
  correction_point: number
  pool_month: string
  pool_year: string
  location: any
  wallet: number
  anonymize_date: string
  data_erasure_date: string
  created_at: string
  updated_at: string
  alumnized_at: any
  "alumni?": boolean
  "active?": boolean
  groups: any[]
  cursus_users: CursusUser[]
  projects_users: ProjectsUser[]
  languages_users: LanguagesUser[]
  achievements: Achievement[]
  titles: any[]
  titles_users: any[]
  partnerships: any[]
  patroned: any[]
  patroning: any[]
  expertises_users: ExpertisesUser[]
  roles: any[]
  campus: Campu[]
  campus_users: CampusUser[]
}

export interface Image {
  link: string
  versions: Versions
}

export interface Versions {
  large: string
  medium: string
  small: string
  micro: string
}

export interface CursusUser {
  id: number
  begin_at: string
  end_at?: string
  grade?: string
  level: number
  skills: Skill[]
  cursus_id: number
  has_coalition: boolean
  blackholed_at?: string
  created_at: string
  updated_at: string
  user: User
  cursus: Cursus
}

export interface Skill {
  id: number
  name: string
  level: number
}

export interface User {
  id: number
  email: string
  login: string
  first_name: string
  last_name: string
  usual_full_name: string
  usual_first_name: any
  url: string
  phone: string
  displayname: string
  kind: string
  image: Image2
  "staff?": boolean
  correction_point: number
  pool_month: string
  pool_year: string
  location: any
  wallet: number
  anonymize_date: string
  data_erasure_date: string
  created_at: string
  updated_at: string
  alumnized_at: any
  "alumni?": boolean
  "active?": boolean
}

export interface Image2 {
  link: string
  versions: Versions2
}

export interface Versions2 {
  large: string
  medium: string
  small: string
  micro: string
}

export interface Cursus {
  id: number
  created_at: string
  name: string
  slug: string
  kind: string
}

export interface ProjectsUser {
  id: number
  occurrence: number
  final_mark?: number
  status: string
  "validated?"?: boolean
  current_team_id: number
  project: Project
  cursus_ids: number[]
  marked_at?: string
  marked: boolean
  retriable_at?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: number
  name: string
  slug: string
  parent_id?: number
}

export interface LanguagesUser {
  id: number
  language_id: number
  user_id: number
  position: number
  created_at: string
}

export interface Achievement {
  id: number
  name: string
  description: string
  tier: string
  kind: string
  visible: boolean
  image: string
  nbr_of_success?: number
  users_url: string
}

export interface ExpertisesUser {
  id: number
  expertise_id: number
  interested: boolean
  value: number
  contact_me: boolean
  created_at: string
  user_id: number
}

export interface Campu {
  id: number
  name: string
  time_zone: string
  language: Language
  users_count: number
  vogsphere_id: number
  country: string
  address: string
  zip: string
  city: string
  website: string
  facebook: string
  twitter: string
  active: boolean
  public: boolean
  email_extension: string
  default_hidden_phone: boolean
}

export interface Language {
  id: number
  name: string
  identifier: string
  created_at: string
  updated_at: string
}

export interface CampusUser {
  id: number
  user_id: number
  campus_id: number
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface FtSecrets {
  ft_secret: string
  ft_uid: string
}


@Injectable({
  providedIn: 'root'
})
export class FtAuthService {
  private ft_secrets: FtSecrets = { ft_secret: '', ft_uid: '' };
  private redirectUri = `${window.location.origin}/auth/callback`;
  private authUrl = 'https://api.intra.42.fr/oauth/authorize';
  private tokenUrl = '/ftapi/oauth/token';
  private accessToken: string | null = null;
  private tokenCreatedAt: Number | null = null;
  private tokenExpiresIn: Number | null = null;
  private refreshToken: string | null = null;
  private secretValidUntil: Number | null = null;
  private base = environment.apiUrl + '/accounts/';
  constructor(private http: HttpClient, private router: Router) { }

  getFtSecrets(): Observable<FtSecrets> {
    return this.http.get<FtSecrets>(`${this.base}get-vault-secret/`);
  }

  // Initiate the OAuth2 login flow
  login(): void {
    this.redirectUri = `${window.location.origin}/auth/callback`;
    this.getFtSecrets().subscribe({ next: (secrets) => {
      this.ft_secrets = secrets;
      const params = new HttpParams()
        .set('client_id', this.ft_secrets.ft_uid)
        .set('redirect_uri', this.redirectUri)
        .set('response_type', 'code')
        .set('scope', 'public');
  
      window.location.href = `${this.authUrl}?${params.toString()}`;
    } });
  }

  // Handle the OAuth2 callback and exchange code for access token
  handleAuthCallback(): Observable<any> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      return this.getFtSecrets().pipe(
        switchMap((secrets: FtSecrets) => {
          this.ft_secrets = secrets;
          // Exchange the authorization code for an access token
          // console.log('Sending token request with client_id:', this.ft_secrets.ft_uid); // Debugging line
  
          const body = new HttpParams()
            .set('grant_type', 'authorization_code')
            .set('client_id', this.ft_secrets.ft_uid)
            .set('client_secret', this.ft_secrets.ft_secret)
            .set('code', code)
            .set('redirect_uri', this.redirectUri);
  
          const headers = new HttpHeaders({
            'Content-Type': 'application/x-www-form-urlencoded'
          });
  
          // console.log("Body:", body);
          // console.log("Headers:", headers);
  
          return this.http.post<any>(this.tokenUrl, body.toString(), { headers }).pipe(
            tap(response => {
              this.accessToken = response.access_token;
              this.tokenCreatedAt = response.created_at;
              this.tokenExpiresIn = response.expires_in;
              this.refreshToken = response.refresh_token;
              this.secretValidUntil = response.secret_valid_until;
              // Ideally, send the token to your backend to create a session
              // For demonstration, we'll set the flag directly
              // Replace with your user service logic
              // Example:
              // this.userService.setAuthenticated(true);
              // Here, we'll use localStorage as a simple example
              // console.log('Access token:', this.accessToken);
              // console.log('response:', response);
              localStorage.setItem('ft_access_token', this.accessToken!);
              localStorage.setItem('ft_refresh_token', this.refreshToken!);
              localStorage.setItem('ft_secret_valid_until', String(this.secretValidUntil!));
              localStorage.setItem('ft_token_created_at', String(this.tokenCreatedAt!));
              localStorage.setItem('ft_token_expires_in', String(this.tokenExpiresIn!));
              this.router.navigate(['/profile']);
            })
          );
        })
      );
    } else {
      // Handle error or missing code
      console.error('Authorization code not found');
      return new Observable();
    }
  }

  // Check if the user is authenticated
  isAuthenticated(): boolean {
    return this.accessToken !== null || !!localStorage.getItem('ft_access_token');
  }

  // Logout the user
  logout(): void {
    this.accessToken = null;
    localStorage.removeItem('ft_access_token');
  }

  // Get the access token
  getAccessToken(): string | null {
    if (!this.accessToken) {
      this.accessToken = localStorage.getItem('ft_access_token');
    }
    return this.accessToken;
  }

  get42UserProfile(): Observable<any> {
    const token = this.getAccessToken();
    if (!token) {
      return throwError('No access token available.');
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // console.log("Getting 42 user profile with header", headers);

    return this.http.get<any>('/ftapi/v2/me', { headers }).pipe(
      catchError(error => {
        console.error('Error fetching 42 user profile:', error);
        return throwError(error);
      })
    );
  }
}
