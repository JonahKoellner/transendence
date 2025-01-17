import { Component, OnInit, OnChanges, SimpleChanges, Input, ElementRef, ViewChild } from '@angular/core';
import { ChatMessage, ChatService } from '../chat.service';

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss']
})
export class ChatWindowComponent implements OnInit, OnChanges {
  @Input() friendId!: number;
  @Input() friendUsername!: string;
  messages: ChatMessage[] = [];
  newMessage: string = '';
  isLoading = false;
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  constructor(private chatService: ChatService) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.joinChatRoom();
    this.loadChatHistory();
    this.listenForIncomingMessages();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const friendIdChange = changes['friendId'];
    if (friendIdChange && !friendIdChange.firstChange) {
      // Reset state for new chat
      this.messages = [];
      this.newMessage = '';
      this.isLoading = true;

      // Update room and reload history for new friend
      this.joinChatRoom();
      this.loadChatHistory();
    }
  }

  loadChatHistory(): void {
    this.chatService.getChatHistory(this.friendId).subscribe(
      (messages) => {
        this.messages = messages;
        this.isLoading = false;
      },
      (error) => {
        console.error(error);
        this.isLoading = false;
      }
    );
  }

  listenForIncomingMessages(): void {
    this.chatService.receiveMessages().subscribe((message: ChatMessage) => {
      if (
        message.sender.username === this.friendUsername ||
        message.receiver.username === this.friendUsername
      ) {
        if (message.notification_type !== 'new_message') return;
        this.messages.push(message);
      }
    });
  }

  sendMessage(): void {
    if (this.newMessage.trim()) {
      this.chatService.sendMessageViaRest(this.newMessage, this.friendId).subscribe(
        (response) => {
          this.messages.push(response);
        },
        (error) => {
          console.error(error);
        }
      );
      this.newMessage = '';
    }
  }

  joinChatRoom(): void {
    const roomName = `chat_${this.friendUsername}`;
    this.chatService.joinRoom(roomName);
  }

  onEnterPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    } catch (err) {
      console.error("Could not scroll to bottom:", err);
    }
  }
}
