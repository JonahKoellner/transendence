import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { NotificationService } from 'src/app/notifications/notification.service';

@Component({
  selector: 'app-remove-friend',
  templateUrl: './remove-friend.component.html',
  styleUrls: ['./remove-friend.component.scss']
})
export class RemoveFriendComponent {
  @Input() userToRemove!: string;
  @Output() close = new EventEmitter<string>();

  constructor(private router: Router) { }

  onAccept(): void {
    this.close.emit('accepted');
  }

  onDecline(): void {
    this.close.emit('declined');
  }
}
