import { Component, OnInit, Input } from '@angular/core';
import { ChatMessage, ChatService } from '../chat.service';

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss']
})
export class ChatWindowComponent implements OnInit {
  @Input() friendId!: number;  // ID of the friend for chat history
  @Input() friendUsername!: string;  // Username of the friend for sending messages
  messages: ChatMessage[] = [];
  newMessage: string = '';  // Model for the message input

  constructor(private chatService: ChatService) { }

  ngOnInit(): void {
    this.joinChatRoom();  // Join WebSocket room for real-time updates
    this.loadChatHistory();  // Load chat history from the backend
    this.listenForIncomingMessages();  // Listen for incoming messages via WebSocket
  }

  // Load chat history using the friend's ID
  loadChatHistory(): void {
    this.chatService.getChatHistory(this.friendId).subscribe((messages) => {
      this.messages = messages;
    });
  }

  // Listen for real-time incoming messages via WebSocket
  listenForIncomingMessages(): void {
    this.chatService.receiveMessages().subscribe((message: ChatMessage) => {
      // Check if the message is part of the current chat
      console.log(message)
      console.log(message.sender.username)
      console.log(message.receiver.username)
      console.log(this.friendUsername)
      if (
        message.sender.username === this.friendUsername ||
        message.receiver.username === this.friendUsername
      ) {
        console.log("Pusing message")
        this.messages.push(message);  // Add the new message to the chat
      }
    });
  }
  
  sendMessage(): void {
    if (this.newMessage.trim()) {
      this.chatService.sendMessageViaRest(this.newMessage, this.friendId).subscribe(
        (response) => {
          this.messages.push(response);  // Add the new message to the chat
        }
      );  // Send via WebSocket
      this.newMessage = '';  // Clear input after sending
    }
  }

  // Join the chat room
  joinChatRoom(): void {
    const roomName = `chat_${this.friendUsername}`;  // Ensure the room name is consistent
    this.chatService.joinRoom(roomName);
  }
}