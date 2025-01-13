import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { environment } from 'src/environment';

@Injectable({
  providedIn: 'root',
})
export class GameDisplayService {
  private socket$!: WebSocketSubject<any>;
  public messages$ = new Subject<any>();
  private isConnected = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient, private authService: AuthService, private router: Router) {}

  connect(matchId: string, roomId: string): void {
    if (this.socket$) {
      this.disconnect();
    }
    if (this.socket$ && this.isConnected.value) return;
    const token = this.authService.getAccessToken();
    // Replace your existing connection logic with the new URL
    this.socket$ = webSocket(environment.wsUrl + `/tournament/${roomId}/${matchId}/?token=${token}`); //TODO see if thats the correct ws URL

    this.socket$.subscribe(
      (msg) => {
        this.messages$.next(msg);
      },
      (err) => {
        console.error('WebSocket error:', err);
        this.handleError(err, matchId, roomId);
      },
      () => console.warn('WebSocket connection closed')
    );
  }

  handleError(msg: any, matchId: string, roomId: string) {
    // navigate user back to tournament screen
    this.router.navigate(['/games/online-tournament/room/' + matchId]);
    this.disconnect();
    // this.deleteRoom(matchId).subscribe(
    //   (res) => {
    //     this.router.navigate(['/games/online-tournament/room/' + matchId])
    //   },
    //   (err) => {
    //     console.log(err);
    //     this.router.navigate(['/games/online-tournament/room/' + matchId])
    //   }
    // );
  }

  ngOnDestroy() {
    this.disconnect();
  }

  disconnect(): void {
    if (this.socket$) {
      this.socket$.complete();
    }
  }

  sendMessage(msg: any): void {
    if (this.socket$) {
      this.socket$.next(msg);
    }
  }

  joinMatch(matchId: string): Observable<any> {
    // Possibly just a GET or POST to tell server “I’m in”
    return this.http.post(environment.apiUrl + '/games/game-display/join/', { matchId: matchId });
  }
}