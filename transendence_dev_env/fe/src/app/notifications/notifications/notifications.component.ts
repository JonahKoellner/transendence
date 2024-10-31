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
  unreadCount: number = 0;
  filterType: string = 'all';
  filterPriority: string = 'all';
  showNotifications: boolean = false;
  showFriendRequestDialog: boolean = false;
  showGameInviteDialog: boolean = false;
  currentNotification: Notification | null = null;
  selectedFriendId: number | null = null;
  selectedFriendUsername: string | null = null;

  constructor(
    private notificationService: NotificationService,
    private userService: ProfileService,
    private chatService: ChatService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.notificationService.getNotifications().subscribe(
      (notifications) => {
        this.notifications = notifications;
        this.updateUnreadCount();
      },
      (error) => console.error(error)
    );
  }

  toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.markAllAsRead();
    }
  }

  markAsRead(notification: Notification): void {
    if (!notification.is_read) {
      this.notificationService.markAsRead(notification.id).subscribe(
        () => {
          notification.is_read = true;
          this.updateUnreadCount();
        },
        (error) => console.error('Error marking as read:', error)
      );
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe(() => {
      this.notifications.forEach((notification) => (notification.is_read = true));
      this.updateUnreadCount();
    });
  }

  updateUnreadCount(): void {
    this.unreadCount = this.notifications.filter((notif) => !notif.is_read).length;
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
    this.markAsRead(notification);
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
      case 'friend_request_accepted':
        return 'accepted your friend request.';
      case 'friend_request_rejected':
        return 'rejected your friend request.';
      case 'game_invite':
        return 'invited you to a game.';
      case 'arena_invite':
        return 'invited you to an arena.';
      case 'tournament':
        return 'sent you a tournament notification.';
      case 'new_message':
        return 'sent you a new message.';
      case 'system_alert':
        return 'sent you a system alert.';
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