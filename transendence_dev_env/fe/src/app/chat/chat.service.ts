import { Injectable } from '@angular/core';
import { WebsocketService } from '../services/websocket.service';
import { Observable, BehaviorSubject, map, of, tap, filter, retryWhen, delay } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

export interface ChatMessage {
  sender: {
    id: number;
    username: string;
  };
  receiver: {
    id: number;
    username: string;
  };
  message: string;
  timestamp: string;
  is_read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:8000/accounts/chat-messages/';
  private messages$ = new BehaviorSubject<ChatMessage[]>([]);

  constructor(private http: HttpClient, private websocketService: WebsocketService, private router: Router) { }

  // Fetch chat history between the current user and a friend
  getChatHistory(friendId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(this.apiUrl+`history?user_id=${friendId}`);
  }

  joinRoom(roomName: string): void {
    this.websocketService.waitForConnection().pipe(
        filter(connected => connected),  // Only proceed if connected
        tap(() => {
            console.log(`Joining room: ${roomName}`);
            this.websocketService.sendMessage({ event: 'join_room', room: roomName });
        }),
        retryWhen(errors => errors.pipe(
            delay(5000),
            tap(() => console.log(`Retrying to join room: ${roomName}`))
        ))
    ).subscribe({
        error: (err) => console.error('Error joining room:', err)
    });
}

  sendMessageViaRest(message: string, receiverId: number): Observable<any> {
    console.log("message ", message, "receiver_id ", receiverId);
    return this.http.post(`${this.apiUrl}send/`, { message, receiver_id: receiverId });
  }

  sendMessageThroughWebSocket(message: string, receiverUsername: string): void {
    const roomName = `chat_${receiverUsername}`;  // The room name must match the backend
    this.websocketService.waitForConnection().pipe(
      tap(connected => {
        if (connected) {
          this.websocketService.sendMessage({
            event: 'chat_message',
            message: message,
            receiver: receiverUsername,
            room: roomName
          });
        } else {
          console.error('WebSocket is not connected, cannot send message.');
        }
      })
    ).subscribe();
  }

  receiveMessages(): Observable<ChatMessage> {
    return this.websocketService.notifications$.pipe(
      map((notification: any) => {
        console.log('Received notification:', notification);
        return {
        sender: {
          id: notification.senderId,
          username: notification.sender,
        },
        receiver: {
          id: notification.receiverId,
          username: notification.receiverUsername,
        },
        message: notification.data.message,
        timestamp: notification.timestamp,
        is_read: notification.isRead,
      }})
    );
  }

  getMessages(): Observable<ChatMessage[]> {
    return this.messages$.asObservable();
  }

  addMessage(message: ChatMessage): void {
    const currentMessages = this.messages$.value;
    this.messages$.next([...currentMessages, message]);
  }
  navigateToGame(game_id: any) {
    this.router.navigate(['/game', game_id]);
  }
}