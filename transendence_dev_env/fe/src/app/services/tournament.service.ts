import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, of, Observable, Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { OnlineTournament } from '../games/tournament/online/online.component'

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  private socket$!: WebSocketSubject<any>;
  public messages$ = new Subject<any>();
  private isConnected = new BehaviorSubject<boolean>(false);

  constructor(private authService: AuthService, private router: Router, private http: HttpClient) {}

  connect(roomId: string) {
    if (this.socket$) {
      this.disconnect();
    }
    if (this.socket$ && this.isConnected.value) return;
    const token = this.authService.getAccessToken(); // Assuming a method to get the access token
    this.socket$ = webSocket(environment.wsUrl + `/tournament/${roomId}/?token=${token}`);

    this.socket$.subscribe(
      (msg) => {this.messages$.next(msg)},
      (err) => {console.error('WebSocket error:', err),this.router.navigate(['/games/online-tournament/rooms'])},
      () => console.warn('WebSocket connection closed')
    );
  }

  disconnect() {
    if (this.socket$) {
      this.socket$.complete();
    }
  }

  sendMessage(msg: any) {
    if (this.socket$) {
      this.socket$.next(msg);
    }
  }

  ngOnDestroy() {
    this.disconnect();
  }

  //HTTP
  // Headers with authorization token
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`
    });
  }

  getTournaments(): Observable<OnlineTournament[]> {
    return this.http.get<OnlineTournament[]>(`${environment.apiUrl}/games/online-tournaments/`, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Error fetching tournaments:', error);
        return of([]);
      })
    );
  }
  
  getTournamentsByUser(userId: number): Observable<OnlineTournament[]> {
    return this.http.get<OnlineTournament[]>(`${environment.apiUrl}/games/online-tournaments/by-user/${userId}/`, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error(`Error fetching games for user ${userId}:`, error);
        return of([]);
      })
    );
  }

  getTournamentById(tournamentId: number): Observable<OnlineTournament> {
    return this.http.get<OnlineTournament>(`${environment.apiUrl}/games/online-tournaments/${tournamentId}/`, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error(`Error fetching online-tournament ${tournamentId}:`, error);
        return of({} as OnlineTournament);
      })
    );
  }

}
