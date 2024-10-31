import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FriendService } from 'src/app/friend.service';
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

  constructor(private friendsService: FriendService) { }

  onAccept(): void {
    console.log(this.notification)
    this.friendsService.acceptFriendRequest(this.notification.sender.id).subscribe(
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
    this.friendsService.rejectFriendRequest(this.notification.sender.id).subscribe(
      () => {
        this.close.emit('declined');
      },
      (error) => {
        console.error(error);
        this.close.emit('error');
      }
    );
  }
}
