import { Component, OnInit, Input, ElementRef, ViewChild } from '@angular/core';
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
  isLoading = false
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  constructor(private chatService: ChatService) { }

  ngOnInit(): void {
    console.log("")
    this.isLoading = true;
    this.joinChatRoom();  // Join WebSocket room for real-time updates
    this.loadChatHistory();  // Load chat history from the backend
    this.listenForIncomingMessages();  // Listen for incoming messages via WebSocket
  }


  // Load chat history using the friend's ID
  loadChatHistory(): void {
    this.chatService.getChatHistory(this.friendId).subscribe((messages) => {
      this.messages = messages;
      // if (messages.length > 0)
      // {
      //   this.scrollToBottom();
      // }
      this.isLoading = false;
      (error: any) => {
        console.error(error);
        this.isLoading = false;
      }
    });
  }

  // Listen for real-time incoming messages via WebSocket
  listenForIncomingMessages(): void {
    this.chatService.receiveMessages().subscribe((message: ChatMessage) => {
      // Check if the message is part of the current chat
      if (
        message.sender.username === this.friendUsername ||
        message.receiver.username === this.friendUsername
      ) {
        if (message.notification_type !== 'new_message') return;  // Ignore other notifications
        // if (this.messages.length > 0)
        //   this.scrollToBottom();
        this.messages.push(message);  // Add the new message to the chat
      }
    });
  }
  
  sendMessage(): void {
    if (this.newMessage.trim()) {
      this.chatService.sendMessageViaRest(this.newMessage, this.friendId).subscribe(
        (response) => {
          // if (this.messages.length > 0)
          //   this.scrollToBottom();
          this.messages.push(response);  // Add the new message to the chat
        },
        (error) => {
          console.error(error);
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

  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    } catch (err) {
      console.error("Could not scroll to bottom:", err);
    }
  }
  onEnterPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent newline in textarea
      this.sendMessage();
    }
  }
}