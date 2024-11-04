import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, delay, Observable, retryWhen, Subject, tap } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from '../auth.service';

@Injectable({
  providedIn: 'root'
})
export class GameLobbyService {
  private socket$!: WebSocketSubject<any>;
  public messages$ = new Subject<any>();
  private isConnected = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient, private authService: AuthService) {}

  connect(roomId: string) {
    if (this.socket$) {
      this.disconnect();
    }
    if (this.socket$ && this.isConnected.value) return;
    const token = this.authService.getAccessToken(); // Assuming a method to get the access token
    this.socket$ = webSocket(`ws://localhost:8000/ws/lobby/${roomId}/?token=${token}`);

    this.socket$.subscribe(
      (msg) => {this.messages$.next(msg),  console.log(msg)},
      (err) => console.error('WebSocket error:', err),
      () => console.warn('WebSocket connection closed')
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



  createRoom(): Observable<{ room_id: string }> {
    return this.http.post<{ room_id: string }>('http://localhost:8000/games/lobby/create/', {});
  }

  joinRoom(roomId: string): Observable<any> {
    return this.http.post('http://localhost:8000/games/lobby/join/', { room_id: roomId });
  }

  getRoomStatus(roomId: string): Observable<any> {
    return this.http.get(`http://localhost:8000/games/lobby/status/${roomId}`);
  }

  setReadyStatus(roomId: string, isReady: boolean, userId: number): Observable<any> {
    return this.http.post('http://localhost:8000/games/lobby/set_ready/', { room_id: roomId, is_ready: isReady, user_id: userId });
  }

  getAllRooms(): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:8000/games/lobby/rooms/`);
  }
}
