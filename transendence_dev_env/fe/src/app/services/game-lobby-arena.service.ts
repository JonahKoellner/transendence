import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, Observable, retryWhen, Subject, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from '../auth.service';
import { GameSettings } from '../games/online-arena/create-room/create-room.component';
import { Router } from '@angular/router';
import { environment } from 'src/environment';

@Injectable({
  providedIn: 'root'
})
export class GameLobbyArenaService {
  private socket$!: WebSocketSubject<any>;
  public messages$ = new Subject<any>();
  private isConnected = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient, private authService: AuthService, private router: Router) {}

  connect(roomId: string) {
    if (this.socket$) {
      this.disconnect();
    }
    if (this.socket$ && this.isConnected.value) return;
    const token = this.authService.getAccessToken(); // Assuming a method to get the access token
    this.socket$ = webSocket(environment.wsUrl + `/lobby_arena/${roomId}/?token=${token}`);

    this.socket$.subscribe(
      (msg) => {this.messages$.next(msg)},
      (err) => {console.error('WebSocket error:', err),this.handleError(err, roomId)},
      () => console.warn('WebSocket connection closed')
    );
  }

  handleError(msg: any, roomId: string) {
    this.router.navigate(['/games/online-arena/rooms'])

    this.deleteRoom(roomId).subscribe(
      (res) => {
        this.router.navigate(['/games/online-arena/rooms'])
      },
      (err) => {
        console.log(err);
        this.router.navigate(['/games/online-arena/rooms'])
      }
    );
  }
  private reconnectIfNeeded(msg: any) {
    this.connect(msg.room_id); // Attempt to reconnect
    this.isConnected.pipe(
      tap(connected => {
        if (connected) {
          this.socket$.next(msg); // Send message after reconnecting
        }
      })
    ).subscribe();
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

  createRoom(settings: GameSettings): Observable<{ room_id: string }> {
    return this.http.post<{ room_id: string }>(environment.apiUrl + '/games/lobby_arena/create/', settings);
  }

  joinRoom(roomId: string): Observable<any> {
    return this.http.post(environment.apiUrl + '/games/lobby_arena/join/', { room_id: roomId });
  }

  getRoomStatus(roomId: string): Observable<any> {
    return this.http.get(environment.apiUrl + `/games/lobby_arena/status/${roomId}`);
  }

  setReadyStatus(roomId: string, isReady: boolean, userId: number): Observable<any> {
    return this.http.post(environment.apiUrl + '/games/lobby_arena/set_ready/', { room_id: roomId, is_ready: isReady, user_id: userId });
  }

  getAllRooms(): Observable<any[]> {
    return this.http.get<any[]>(environment.apiUrl + `/games/lobby_arena/rooms/`);
  }
  deleteRoom(roomId: string): Observable<any> {
    return this.http.delete(environment.apiUrl + `/games/lobby_arena/delete/${roomId}`);
  }
}
