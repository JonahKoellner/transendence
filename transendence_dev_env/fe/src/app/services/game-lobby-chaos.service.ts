import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, Observable, retryWhen, Subject, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from '../auth.service';
import { GameSettings } from '../games/online-pvp-chaos/create-room/create-room-chaos.component';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GameLobbyChaosService {
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
    this.socket$ = webSocket(environment.wsUrl + `/lobby_chaos/${roomId}/?token=${token}`);

    this.socket$.subscribe(
      (msg) => {this.messages$.next(msg),  console.log(msg, roomId)},
      (err) => {console.error('WebSocket error:', err),this.handleError(err, roomId)},
      () => console.warn('WebSocket connection closed')
    );
  }

  handleError(msg: any, roomId: string) {
    this.router.navigate(['/games/online-pvp-chaos/rooms'])

    this.deleteRoom(roomId).subscribe(
      (res) => {
        console.log(res);
        this.router.navigate(['/games/online-pvp-chaos/rooms'])
      },
      (err) => {
        console.log(err);
        this.router.navigate(['/games/online-pvp-chaos/rooms'])
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
    return this.http.post<{ room_id: string }>(environment.apiUrl + '/games/lobby_chaos/create/', settings);
  }

  joinRoom(roomId: string): Observable<any> {
    return this.http.post(environment.apiUrl + '/games/lobby_chaos/join/', { room_id: roomId });
  }

  getRoomStatus(roomId: string): Observable<any> {
    return this.http.get(environment.apiUrl + `/games/lobby_chaos/status/${roomId}`);
  }

  setReadyStatus(roomId: string, isReady: boolean, userId: number): Observable<any> {
    return this.http.post(environment.apiUrl + '/games/lobby_chaos/set_ready/', { room_id: roomId, is_ready: isReady, user_id: userId });
  }

  getAllRooms(): Observable<any[]> {
    return this.http.get<any[]>(environment.apiUrl + `/games/lobby_chaos/rooms/`);
  }
  deleteRoom(roomId: string): Observable<any> {
    return this.http.delete(environment.apiUrl + `/games/lobby_chaos/delete/${roomId}`);
  }
}
