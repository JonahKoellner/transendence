import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, Observable, retryWhen, Subject, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from '../auth.service';
import { GameSettings } from '../games/online-pvp/create-room/create-room.component';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GameLobbyService {
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
    // this.socket$ = webSocket(`ws://localhost:8000/ws/lobby/${roomId}/?token=${token}`);
    this.socket$ = webSocket(environment.wsUrl + `/lobby/${roomId}/?token=${token}`);

    this.socket$.subscribe(
      (msg) => {this.messages$.next(msg),  console.log(msg, roomId)},
      (err) => {console.error('WebSocket error:', err),this.handleError(err, roomId)},
      () => console.warn('WebSocket connection closed')
    );
  }

  handleError(msg: any, roomId: string) {
    this.router.navigate(['/games/online-pvp/rooms'])

    this.deleteRoom(roomId).subscribe(
      (res) => {
        console.log(res);
        this.router.navigate(['/games/online-pvp/rooms'])
      },
      (err) => {
        console.log(err);
        this.router.navigate(['/games/online-pvp/rooms'])
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
    // return this.http.post<{ room_id: string }>('http://localhost:8000/games/lobby/create/', settings);
    return this.http.post<{ room_id: string }>(environment.apiUrl + '/games/lobby/create/', settings);
  }

  joinRoom(roomId: string): Observable<any> {
    // return this.http.post('http://localhost:8000/games/lobby/join/', { room_id: roomId });
    return this.http.post(environment.apiUrl + '/games/lobby/join/', { room_id: roomId });
  }

  getRoomStatus(roomId: string): Observable<any> {
    // return this.http.get(`http://localhost:8000/games/lobby/status/${roomId}`);
    return this.http.get(environment.apiUrl + `/games/lobby/status/${roomId}`);
  }

  setReadyStatus(roomId: string, isReady: boolean, userId: number): Observable<any> {
    // return this.http.post('http://localhost:8000/games/lobby/set_ready/', { room_id: roomId, is_ready: isReady, user_id: userId });
    return this.http.post(environment.apiUrl + '/games/lobby/set_ready/', { room_id: roomId, is_ready: isReady, user_id: userId });
  }

  getAllRooms(): Observable<any[]> {
    // return this.http.get<any[]>(`http://localhost:8000/games/lobby/rooms/`);
    return this.http.get<any[]>(environment.apiUrl + `/games/lobby/rooms/`);
  }
  deleteRoom(roomId: string): Observable<any> {
    // return this.http.delete(`http://localhost:8000/games/lobby/delete/${roomId}`);
    return this.http.delete(environment.apiUrl + `/games/lobby/delete/${roomId}`);
  }
}
