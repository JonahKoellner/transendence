import { Component } from '@angular/core';
import { FriendService } from 'src/app/friend.service';
import { UserProfile } from 'src/app/profile.service';

@Component({
  selector: 'app-friend-list',
  templateUrl: './friend-list.component.html',
  styleUrls: ['./friend-list.component.scss']
})
export class FriendListComponent {
  friends: UserProfile[] = [];
  isLoading: boolean = true;
  error: string = '';
  selectedFriendId: number | null = null;  // Keep track of selected friend's ID for chat
  selectedFriendUsername: string | null = null;  // Keep track of selected friend's username for chat

  constructor(private friendService: FriendService) { }

  ngOnInit(): void {
    this.loadFriends();
  }

  loadFriends(): void {
    this.friendService.getFriends().subscribe(
      (data) => {
        this.friends = data;
        this.isLoading = false;
      },
      (error) => {
        console.error(error);
        this.error = 'Failed to load friends.';
        this.isLoading = false;
      }
    );
  }

  removeFriend(userId: number): void {
    this.friendService.removeFriend(userId).subscribe(
      () => {
        this.friends = this.friends.filter(friend => friend.id !== userId);
      },
      (error) => {
        console.error(error);
        this.error = 'Failed to remove friend.';
      }
    );
  }

  blockUser(userId: number): void {
    this.friendService.blockUser(userId).subscribe(
      () => {
        this.friends = this.friends.filter(friend => friend.id !== userId);
      },
      (error) => {
        console.error(error);
        this.error = 'Failed to block user.';
      }
    );
  }

  // Opens the chat window with the selected friend's ID and username
  openChat(friendId: number, friendUsername: string): void {
    this.selectedFriendId = friendId;
    this.selectedFriendUsername = friendUsername;
    console.log(this.selectedFriendId, this.selectedFriendUsername)
  }
}