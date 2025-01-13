// import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, Observable, retryWhen, Subject, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from '../auth.service';
// import { GameSettings } from '../games/tournament/online/create-room/create-room.component';
import { Router } from '@angular/router';
import { environment } from 'src/environment';

@Injectable({
  providedIn: 'root'
})
export class TournamentService {
  private socket$!: WebSocketSubject<any>;
  public messages$ = new Subject<any>();
  private isConnected = new BehaviorSubject<boolean>(false);

  constructor(private authService: AuthService, private router: Router) { }

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

}
