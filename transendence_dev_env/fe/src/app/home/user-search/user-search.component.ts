import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { FriendService } from 'src/app/friend.service';
import { ProfileService, UserProfile } from 'src/app/profile.service';

@Component({
  selector: 'app-user-search',
  templateUrl: './user-search.component.html',
  styleUrls: ['./user-search.component.scss']
})
export class UserSearchComponent {
  searchQuery: string = '';
  users: UserProfile[] = [];
  error: string = '';
  successMessage: string = '';
  isLoading: boolean = false;

  constructor(private userService: ProfileService, private friendService: FriendService, private toastr: ToastrService) { }

  searchUsers(): void {
    console.log('Searching for users:', this.searchQuery);
    if (this.searchQuery.trim() === '') {
      this.users = [];
      return;
    }

    this.isLoading = true;
    this.userService.searchUsers(this.searchQuery).subscribe(
      (data) => {
        this.users = data;
        this.error = '';
        this.isLoading = false;
      },
      (err) => {
        this.error = 'Error searching users.';
        this.isLoading = false;
        this.toastr.error('Error searching users.', 'Error');
      }
    );
  }

  sendFriendRequest(userId: number): void {
    this.friendService.sendFriendRequest(userId).subscribe(
      () => {
        this.successMessage = 'Friend request sent successfully.';
        this.error = '';
        // Optionally, update the user list to reflect the change
      },
      (err) => {
        this.error = err.error.detail || 'Error adding friend.';
        this.successMessage = '';
        this.toastr.error('Error adding friend.', 'Error');
      }
    );
  }
}
