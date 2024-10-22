import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ProfileService } from 'src/app/profile.service';

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
  selector: 'app-friend-request-dialog',
  templateUrl: './friend-request-dialog.component.html',
  styleUrls: ['./friend-request-dialog.component.scss']
})
export class FriendRequestDialogComponent {
  @Input() notification!: Notification;
  @Output() close = new EventEmitter<string>();

  constructor(private userService: ProfileService) { }

  onAccept(): void {
    console.log(this.notification)
    this.userService.addFriend(this.notification.sender.id).subscribe(
      () => {
        this.close.emit('accepted');
      },
      (error) => {
        console.error(error);
        this.close.emit('error');
      }
    );
  }

  onDecline(): void {
    // Optionally, implement decline logic
    this.close.emit('declined');
  }
}
