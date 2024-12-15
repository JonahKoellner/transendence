import { Component, OnInit } from '@angular/core';
import { Notification, NotificationService } from '../notification.service';
import { ProfileService } from 'src/app/profile.service';
import { ChatService } from 'src/app/chat/chat.service';
import { AuthService } from 'src/app/auth.service';
import { ToastrService } from 'ngx-toastr';


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
  notificationTypes = [
    'friend_request',
    'friend_request_accepted',
    'friend_request_rejected',
    'game_invite',
    'arena_invite',
    'tournament',
    'new_message',
    'system_alert',
    'level_up',
    "achievement_unlocked"
  ];
  selectedType = '';
  filteredNotifications: Notification[] = [];
  selectedReadStatus = 'unread';
  constructor(
    private notificationService: NotificationService,
    private userService: ProfileService,
    private chatService: ChatService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.notificationService.getNotifications().subscribe(
      (notifications) => {
        this.notifications = notifications;
        console.log(notifications);
        this.updateUnreadCount();
        this.filterNotifications();
      },
      (error) => this.toastr.error('Failed to load notifications. Please try again later.', 'Error')
    );
  }

  toggleNotifications(): void {
    console.log('Toggling notifications');
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      // this.markAllAsRead();
    }
  }

  markAsRead(notification: Notification): void {
    if (!notification.is_read) {
      this.notificationService.markAsRead(notification.id).subscribe(
        () => {
          notification.is_read = true;
          this.updateUnreadCount();
        },
        (error) => this.toastr.error('Failed to mark notification as read. Please try again later.', 'Error')
      );
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe(() => {
      this.notifications.forEach((notification) => (notification.is_read = true));
      this.updateUnreadCount();
    });
  }

  localClearAll(): void {
    this.notifications = [];
    this.filteredNotifications = [];
    this.updateUnreadCount();
  }

  clearAll(): void {
    this.notificationService.clearAll().subscribe(() => {
      this.localClearAll();
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
    if (result === 'accepted' && this.currentNotification) {
      this.markAsRead(this.currentNotification);
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
        return 'sent you a new message.'
      case 'level_up':
        return 'you leveled up!';
      case 'system_alert':
        return 'sent you a system alert.';
      case 'achievement_unlocked':
        return 'unlocked an achievement!';
      default:
        return 'has an update.';
    }
  }

  getIconClass(notificationType: string): string {
    switch (notificationType) {
      case 'friend_request':
        return 'fas fa-user-friends';
      case 'game_invite':
        return 'fas fa-gamepad';
      case 'new_message':
        return 'fas fa-envelope';
      case 'system_alert':
        return 'fas fa-exclamation-circle';
      case 'level_up':
        return 'fas fa-level-up-alt';
      case 'achievement_unlocked':
        return 'fas fa-trophy';
      default:
        return 'fas fa-bell';
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
  filterNotifications() {
    this.filteredNotifications = this.notifications.filter((notification) => {
      const matchesType = this.selectedType
        ? notification.notification_type === this.selectedType
        : true;
      const matchesReadStatus =
        this.selectedReadStatus === 'unread'
          ? !notification.is_read
          : this.selectedReadStatus === 'read'
          ? notification.is_read
          : true;
      return matchesType && matchesReadStatus;
    });
  }
}