import { Component, HostListener } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { FriendService } from 'src/app/friend.service';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-friend-list',
  templateUrl: './friend-list.component.html',
  styleUrls: ['./friend-list.component.scss']
})
export class FriendListComponent {
  friends: UserProfile[] = [];
  friendRequests: any[] = [];
  blockedUsers: UserProfile[] = [];
  activeTab: string = 'friends';
  isLoading: boolean = true;
  error: string = '';
  selectedFriendId: number | null = null;
  selectedFriendUsername: string | null = null;
  currentUser: UserProfile | null = null;
  userToBlock: string = '';
  userToRemove: string = '';
  showRemoveFriendDialog: boolean = false;
  showBlockUserDialog: boolean = false;

  userToRemoveId: number | null = null;
  userToBlockId: number | null = null;
  chatWindowPosition = { x: 100, y: 100 };
  isDragging = false;
  dragOffset = { x: 0, y: 0 };

  pFriends: number = 1; // Current page
  itemsPerPageFriends: number = 25; // Items per page

  pFriendRequests: number = 1; // Current page
  itemsPerPageFriendRequests: number = 25; // Items per page

  pBlockedUsers: number = 1; // Current page
  itemsPerPageBlockedUsers: number = 25; // Items per page

  public apiurl = environment.apiUrl;


  constructor(private friendService: FriendService,private profileService: ProfileService, private toastr: ToastrService) { }

  ngOnInit(): void {

    this.initData();
    this.loadCurrentUser();
  }

  onPageChangeFriends(page: number) {
    this.pFriends = page;
  }

  onPageChangeFriendRequests(page: number) {
    this.pFriendRequests = page;
  }

  onPageChangeBlockedUsers(page: number) {
    this.pBlockedUsers = page;
  }

  loadCurrentUser(): void {
    this.profileService.getProfile().subscribe(
      (user) => {
        this.currentUser = user;
      },
      (error) => {
        this.toastr.error('Failed to load current user profile.', 'Error');
        this.error = 'Failed to load current user profile.';
      }
    );
  }

  initData(): void {
    this.loadFriends();
    this.loadFriendRequests();
    this.loadBlockedUsers();
  } 
  
  selectTab(tab: string): void {
    this.initData();
    this.activeTab = tab;
  }

  loadFriends(): void {
    this.friendService.getFriends().subscribe(
      (data) => {
        this.friends = data;
        this.isLoading = false;
      },
      (error) => {
        this.toastr.error('Failed to load friends.', 'Error');
        this.error = 'Failed to load friends.';
        this.isLoading = false;
      }
    );
  }

  loadFriendRequests(): void {
    this.friendService.getFriendRequests().subscribe(
      async (data) => {
        // Map each friend request to include sender and receiver details
        this.friendRequests = await Promise.all(data.map(async (request: any) => {
          const senderDetails = await this.profileService.getUserDetails(request.sender).toPromise();
          const receiverDetails = await this.profileService.getUserDetails(request.receiver).toPromise();
          return {
            ...request,
            sender_username: senderDetails?.username || 'Unknown',
            receiver_username: receiverDetails?.username || 'Unknown',
          };
        }));
        this.isLoading = false;
      },
      (error) => {
        this.toastr.error('Failed to load friend requests.', 'Error');
        this.error = 'Failed to load friend requests.';
        this.isLoading = false;
      }
    );
  }


  loadBlockedUsers(): void {
    this.friendService.getBlockedUsers().subscribe(
      (data) => {
        this.blockedUsers = data;
        this.isLoading = false;
      },
      (error) => {
        this.toastr.error('Failed to load blocked users.', 'Error');
        this.error = 'Failed to load blocked users.';
        this.isLoading = false;
      }
    );
  }

  unblockUser(userId: number): void {
    this.friendService.unblockUser(userId).subscribe(
      () => {
        this.blockedUsers = this.blockedUsers.filter(user => user.id !== userId);
        this.initData();
      },
      (error) => {
        this.toastr.error('Failed to unblock user.', 'Error');
        this.error = 'Failed to unblock user.';
      }
    );
  }

  acceptFriendRequest(requestId: number): void {
    this.friendService.acceptFriendRequest(requestId).subscribe(
      () => {
        this.friendRequests = this.friendRequests.filter(request => request.id !== requestId);
        this.initData();
      },
      (error) => {
        this.toastr.error('Failed to accept friend request.', 'Error');
        this.error = 'Failed to accept friend request.';
      }
    );
  }

  rejectFriendRequest(requestId: number): void {
    this.friendService.rejectFriendRequest(requestId).subscribe(
      () => {
        this.friendRequests = this.friendRequests.filter(request => request.id !== requestId);
        this.initData();
      },
      (error) => {
        this.toastr.error('Failed to reject friend request.', 'Error');
        this.error = 'Failed to reject friend request.';
      }
    );
  }

  openChat(friendId: number, friendUsername: string): void {
    this.selectedFriendId = friendId;
    this.selectedFriendUsername = friendUsername;
  }
  closeChat(): void {
    this.selectedFriendId = null;
    this.selectedFriendUsername = null;
  }

  onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.dragOffset = {
      x: event.clientX - this.chatWindowPosition.x,
      y: event.clientY - this.chatWindowPosition.y
    };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      const chatWidth = 350; // Width of the chat window
      const chatHeight = 400; // Estimated height of the chat window

      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate new position
      let newX = event.clientX - this.dragOffset.x;
      let newY = event.clientY - this.dragOffset.y;

      // Constrain within boundaries
      newX = Math.max(0, Math.min(newX, viewportWidth - chatWidth));
      newY = Math.max(0, Math.min(newY, viewportHeight - chatHeight));

      // Set constrained position
      this.chatWindowPosition = { x: newX, y: newY };
    }
  }

  @HostListener('window:mouseup')
  onMouseUp(): void {
    this.isDragging = false;
  }


  onCloseRemoveFriendDialog(result: string): void {
    if (result === 'accepted' && this.userToRemoveId !== null) {
      this.executeRemoveFriend(this.userToRemoveId);
      this.showRemoveFriendDialog = false;
      this.userToRemoveId = null;
      this.userToRemove = '';
    } else {
      this.showRemoveFriendDialog = false;
      this.userToRemoveId = null;
      this.userToRemove = '';
    }
  }

  onCloseBlockFriendDialog(result: string): void {
    if (result === 'accepted' && this.userToBlockId !== null) {
      this.executeBlockUser(this.userToBlockId);
      this.showBlockUserDialog = false;
      this.userToBlockId = null;
      this.userToBlock = '';
    } else {
      this.showBlockUserDialog = false;
      this.userToBlockId = null;
      this.userToBlock = '';
    }
  }

  removeFriend(userId: number, username: string): void {
    this.userToRemoveId = userId;
    this.showRemoveFriendDialog = true;
    this.userToRemove = username;
    console.log('removeFriend', userId, username);
  }

  blockUser(userId: number, username: string): void {
    this.userToBlockId = userId;
    this.showBlockUserDialog = true;
    this.userToBlock = username;
  }

  // Add methods to perform the actual actions
  executeRemoveFriend(userId: number): void {
    this.friendService.removeFriend(userId).subscribe(
      () => {
        this.friends = this.friends.filter(friend => friend.id !== userId);
        this.initData();
        this.showRemoveFriendDialog = false;
        this.userToRemoveId = null;
      },
      (error) => {
        this.toastr.error('Failed to remove friend.', 'Error');
        this.error = 'Failed to remove friend.';
        this.showRemoveFriendDialog = false;
        this.userToRemoveId = null;
      }
    );
  }

  executeBlockUser(userId: number): void {
    this.friendService.blockUser(userId).subscribe(
      () => {
        this.friends = this.friends.filter(friend => friend.id !== userId);
        this.initData();
        this.showBlockUserDialog = false;
        this.userToBlockId = null;
      },
      (error) => {
        this.toastr.error('Failed to block user.', 'Error');
        this.error = 'Failed to block user.';
        this.showBlockUserDialog = false;
        this.userToBlockId = null;
      }
    );
  }
}