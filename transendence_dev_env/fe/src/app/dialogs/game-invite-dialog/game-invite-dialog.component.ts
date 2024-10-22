import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

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

  constructor(private router: Router) { }

  onAccept(): void {
    // Navigate to the game using game_id from notification.data
    if (this.notification.data && this.notification.data.game_id) {
      this.router.navigate(['/game', this.notification.data.game_id]);
      this.close.emit('accepted');
    } else {
      console.error('Game ID not found in notification data.');
      this.close.emit('error');
    }
  }

  onDecline(): void {
    // Optionally, implement decline logic
    this.close.emit('declined');
  }
}
