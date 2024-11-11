import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from 'src/app/notifications/notification.service';

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
  selector: 'app-game-invite-dialog',
  templateUrl: './game-invite-dialog.component.html',
  styleUrls: ['./game-invite-dialog.component.scss']
})
export class GameInviteDialogComponent {
  @Input() notification!: Notification;
  @Output() close = new EventEmitter<string>();

  constructor(private router: Router, private notificationService: NotificationService) { }

  onAccept(): void {
    this.close.emit('accepted');
    this.router.navigate(['/games/online-pvp/game-room', this.notification.data.room_id]);
  }

  onDecline(): void {
    // Optionally, implement decline logic
    this.close.emit('declined');
  }
}
