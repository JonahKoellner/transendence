import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FriendService } from 'src/app/friend.service';
import { Notification } from 'src/app/notifications/notification.service';
import { ProfileService } from 'src/app/profile.service';

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
    console.log(this.notification);
    const friendRequestId = this.notification.data.friend_request_id ?? 0;
    this.friendsService.acceptFriendRequest(friendRequestId).subscribe(
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
    console.log(this.notification);
    const friendRequestId = this.notification.data.friend_request_id ?? 0;
    this.friendsService.rejectFriendRequest(friendRequestId).subscribe(
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
