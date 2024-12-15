import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Notification, NotificationService } from 'src/app/notifications/notification.service';


@Component({
  selector: 'app-game-invite-dialog',
  templateUrl: './game-invite-dialog.component.html',
  styleUrls: ['./game-invite-dialog.component.scss']
})
export class GameInviteDialogComponent {
  @Input() notification!: Notification;
  @Output() close = new EventEmitter<string>();

  constructor(private router: Router, private notificationService: NotificationService, private toastr: ToastrService) { }

  onAccept(): void {
    this.close.emit('accepted');
    if (this.notification.data.game_type == "classic") {
      this.router.navigate(['/games/online-pvp/game-room', this.notification.data.room_id]);
    } else if (this.notification.data.game_type == "chaos") {
      this.router.navigate(['/games/online-pvp-chaos/game-room/', this.notification.data.room_id]);
    }else if (this.notification.data.game_type == "arena") {
      this.router.navigate(['/games/online-arena/game-room', this.notification.data.room_id]);
    } else {
      this.toastr.error('Invalid game type.', 'Error');
    }
  }

  onDecline(): void {
    // Optionally, implement decline logic
    this.close.emit('declined');
  }
}
