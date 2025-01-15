import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-block-friend',
  templateUrl: './block-friend.component.html',
  styleUrls: ['./block-friend.component.scss']
})
export class BlockFriendComponent {
  @Input() userToBlock!: string;
  @Output() close = new EventEmitter<string>();

  constructor(private router: Router) { }

  onAccept(): void {
    this.close.emit('accepted');
  }

  onDecline(): void {
    this.close.emit('declined');
  }
}
