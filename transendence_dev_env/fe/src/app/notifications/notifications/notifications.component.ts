import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../notification.service';
import { ProfileService } from 'src/app/profile.service';
import { ChatService } from 'src/app/chat/chat.service';
import { AuthService } from 'src/app/auth.service';


interface Notification {
  id: number;
  sender: {
    id: number;
    username: string;
    email: string;
  };
  notification_type: string;
  priority: string;
  timestamp: string;
  is_read: boolean;
  data?: any;
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  filterType: string = 'all';
  filterPriority: string = 'all';
  showFriendRequestDialog: boolean = false;
  showGameInviteDialog: boolean = false;
  currentNotification: Notification | null = null;
  selectedFriendId: number | null = null;  // Track friend ID
  selectedFriendUsername: string | null = null;  // Track friend username

  constructor(
    private notificationService: NotificationService,
    private userService: ProfileService,
    private chatService: ChatService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      // Fetch historical notifications on component initialization
      this.notificationService.getNotifications().subscribe(
        (notifications) => {
          this.notifications = notifications;
        },
        (error) => console.error(error)
      );
    }
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markAsRead(notification.id).subscribe(
      () => {
        notification.is_read = true;
      },
      (error) => console.error(error)
    );
  }

  handleNotification(notification: Notification): void {
    this.currentNotification = notification;
    switch (notification.notification_type) {
      case 'friend_request':
        this.showFriendRequestDialog = true;
        break;
      case 'game_invite':
        this.showGameInviteDialog = true;
        break;
      case 'new_message':
        this.openChat(notification.sender.id, notification.sender.username);
        break;
      default:
        console.log('Unhandled notification type:', notification.notification_type);
    }
  }

  onCloseFriendRequestDialog(result: string): void {
    this.showFriendRequestDialog = false;
    if (this.currentNotification) {
      this.markAsRead(this.currentNotification);
    }
    this.currentNotification = null;
  }

  onCloseGameInviteDialog(result: string): void {
    this.showGameInviteDialog = false;
    if (result === 'accepted' && this.currentNotification?.data?.game_id) {
      this.chatService.navigateToGame(this.currentNotification.data.game_id);
    }
    if (this.currentNotification) {
      this.markAsRead(this.currentNotification);
    }
    this.currentNotification = null;
  }

  openChat(friendId: number, friendUsername: string): void {
    this.selectedFriendId = friendId;
    this.selectedFriendUsername = friendUsername;
  }

  closeChat(): void {
    this.selectedFriendId = null;
    this.selectedFriendUsername = null;
  }

  getNotificationText(type: string): string {
    switch (type) {
      case 'friend_request':
        return 'sent you a friend request.';
      case 'game_invite':
        return 'invited you to a game.';
      case 'new_message':
        return 'sent you a new message.';
      default:
        return 'has an update.';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'high':
        return 'high-priority';
      case 'medium':
        return 'medium-priority';
      case 'low':
        return 'low-priority';
      default:
        return '';
    }
  }
}