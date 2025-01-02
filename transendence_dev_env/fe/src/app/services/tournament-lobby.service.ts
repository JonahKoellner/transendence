import { HttpClient } from '@angular/common/http';
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
export class TournamentLobbyService {
  private socket$!: WebSocketSubject<any>;
  public messages$ = new Subject<any>();
  private isConnected = new BehaviorSubject<boolean>(false);
  private currentRoomId: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService, private router: Router) {}

  connect(roomId: string) {
    if (this.socket$) {
      this.disconnect();
    }
    if (this.socket$ && this.isConnected.value) return;
    this.currentRoomId = roomId;
    const token = this.authService.getAccessToken(); // Assuming a method to get the access token
    this.socket$ = webSocket(environment.wsUrl + `/tournament-lobby/${roomId}/?token=${token}`);

    this.socket$.subscribe(
      (msg) => {this.messages$.next(msg)},
      (err) => {console.error('WebSocket error:', err),this.handleError(err, roomId)},
      () => console.warn('WebSocket connection closed')
    );
  }

  handleError(msg: any, roomId: string) {
    this.router.navigate(['/games/online-tournament/rooms'])

    this.deleteRoom(roomId).subscribe(
      (res) => {
        this.router.navigate(['/games/online-tournament/rooms'])
      },
      (err) => {
        console.log(err);
        this.router.navigate(['/games/online-tournament/rooms'])
      }
    );
  }

  // private reconnectIfNeeded(msg: any) {
  //   this.connect(msg.room_id); // Attempt to reconnect
  //   this.isConnected.pipe(
  //     tap(connected => {
  //       if (connected) {
  //         this.socket$.next(msg); // Send message after reconnecting
  //       }
  //     })
  //   ).subscribe();
  // }

  private reconnect() {
    setTimeout(() => {
      if (!this.isConnected.value && this.currentRoomId) {
        this.connect(this.currentRoomId);
      }
    }, 5000);
  }
  

  sendMessage(msg: any) {
    if (this.socket$) {
      this.socket$.next(msg);
    }
  }

  disconnect() {
    if (this.socket$) {
      this.socket$.complete();
    }
  }

  ngOnDestroy() {
    this.disconnect();
  }

  createRoom(): Observable<{ room_id: string }> {
    return this.http.post<{ room_id: string }>(environment.apiUrl + '/games/tournament_lobby/create/', {});
  }

  joinRoom(roomId: string): Observable<any> {
    return this.http.post(environment.apiUrl + '/games/tournament_lobby/join/', { room_id: roomId });
  }

  getRoomStatus(roomId: string): Observable<any> {
    return this.http.get(environment.apiUrl + `/games/tournament_lobby/status/${roomId}/`);
  }

  setReadyStatus(roomId: string, isReady: boolean, userId: number): Observable<any> {
    return this.http.post(environment.apiUrl + '/games/tournament_lobby/ready/', { room_id: roomId, is_ready: isReady, user_id: userId });
  }

  getAllRooms(): Observable<any[]> {
    return this.http.get<any[]>(environment.apiUrl + `/games/tournament_lobby/rooms/`);
  }

  deleteRoom(roomId: string): Observable<any> {
    return this.http.delete(environment.apiUrl + `/games/tournament_lobby/delete/${roomId}/`);
  }
}
