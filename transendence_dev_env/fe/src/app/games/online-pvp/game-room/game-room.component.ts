import { Component, OnInit, OnDestroy, HostListener, TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameLobbyService } from 'src/app/services/game-lobby.service';
import { Subscription } from 'rxjs';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { NotificationService, SendGameInvitePayload } from 'src/app/notifications/notification.service';
import { FriendService } from 'src/app/friend.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { environment } from 'src/environments/environment';

interface GameSettings {
  paddleskin_color_left?: string;
  paddleskin_image_left?: string;
  paddleskin_color_right?: string;
  paddleskin_image_right?: string;
  ballskin_color?: string;
  ballskin_image?: string;
  gamebackground_color?: string;
  gamebackground_wallpaper?: string;
}



@Component({
  selector: 'app-game-room',
  templateUrl: './game-room.component.html',
  styleUrls: ['./game-room.component.scss']
})
export class GameRoomComponent implements OnInit, OnDestroy {
  roomId: string = '';
  host: string = '';
  guest: string = 'Waiting for guest';
  isHostReady = false;
  isGuestReady = false;
  allReady = false;
  gameInProgress = false;
  gameState: any = {};
  leftScore: number = 0;
  rightScore: number = 0;
  guestId: number = 0;
  isHost: boolean = false;
  private messageSubscription!: Subscription;
  userProfile: UserProfile | null = null;
  public msgFromServer: any;
  roomData: any;
  friends: UserProfile[] = [];
  winner: string = '';
  gameSettings: GameSettings = {};
  inviteFriendOpen: boolean = false;
  constructor(
    private route: ActivatedRoute,
    private lobbyService: GameLobbyService,
    private userProfileService: ProfileService,
    private router: Router,
    private notificationService: NotificationService,
    private friendService: FriendService,
    public modalService: NgbModal
  ) {}

  ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    this.lobbyService.joinRoom(this.roomId).subscribe({
      next: (data) => {
        console.log('Joined room:', data);
        this.lobbyService.connect(this.roomId);
        this.loadFriends();
        this.messageSubscription = this.lobbyService.messages$.subscribe(msg => {
          this.msgFromServer = msg;
          if (msg.type === 'initial_state') {
            this.host = msg.host;
            this.guest = msg.guest;
            this.guestId = msg.guestId;
            this.isHostReady = msg.isHostReady;
            this.isGuestReady = msg.isGuestReady;
            this.allReady = msg.allReady;
          } else if (msg.type === 'ready_status') {
            this.isHostReady = msg.isHostReady;
            this.isGuestReady = msg.isGuestReady;
            this.allReady = msg.allReady;
            this.host = msg.host;
            this.guest = msg.guest;
            this.guestId = msg.guestId;
          } else if (msg.type === 'game_state') {
            this.gameState = msg;
            this.leftScore = msg.leftScore;
            this.rightScore = msg.rightScore;
          } else if (msg.type === 'game_started') {
            this.gameInProgress = true;
          } else if (msg.type === 'alert') {
            // Check if the disconnecting user was the host or guest
            if (msg.user_role === 'host') {
              alert('The host has left the game. Redirecting you to the lobby.');
              this.router.navigate(['/games/online-pvp/rooms']);
            } else if (msg.user_role === 'guest') {
              this.guest = 'Waiting for guest';
              this.isGuestReady = false;
              this.allReady = false;
              if (this.gameInProgress) {
                alert('The guest has left the game. The game will be terminated.');
                this.gameInProgress = false;
                this.isGuestReady = false;
                this.allReady = false;
                this.router.navigate(['/games/online-pvp/rooms']);
              }
            }
          } else if (msg.type === 'game_ended') {
            this.gameInProgress = false;
            this.isHostReady = false;
            this.isGuestReady = false;
            this.allReady = false;
            this.gameState = {};
            this.leftScore = 0;
            this.rightScore = 0;
            if (msg.winner) this.winner = msg.winner;
            this.lobbyService.setReadyStatus(this.roomId, false, this.userProfile!.id).subscribe(
              () => {
                this.lobbyService.sendMessage({
                  action: 'set_ready',
                  room_id: this.roomId,
                  user_id: this.userProfile?.id,
                  is_ready: false
                });
              },
              (error) => {
                console.error('Error setting ready status:', error);
                this.router.navigate(['/games/online-pvp/rooms']);
              }
            );
            console.log('Game over!');
            console.log('msg:', msg);
          } else if (msg.type === 'round_completed') {
            console.log('Round completed!');
          }
          if (this.host === "")
          {
            this.router.navigate(['/games/online-pvp/rooms']);
          }
          if(msg.type !== 'game_state')
          {
            this.lobbyService.getRoomStatus(this.roomId).subscribe(
              (data: any) => {
                this.roomData = data;
                this.host = data.host;
                this.guest = data.guest || 'Waiting for guest';
                this.isHostReady = data.is_host_ready;
                this.isGuestReady = data.is_guest_ready;
                this.allReady = data.all_ready;
                this.gameSettings.paddleskin_color_left = data.paddleskin_color_left;
                // this.gameSettings.paddleskin_image_left = "http://localhost:8000" + data.paddleskin_image_left;
                this.gameSettings.paddleskin_image_left = environment.apiUrl + data.paddleskin_image_left;
                this.gameSettings.paddleskin_color_right = data.paddleskin_color_right;
                // this.gameSettings.paddleskin_image_right = "http://localhost:8000" + data.paddleskin_image_right;
                this.gameSettings.paddleskin_image_right = environment.apiUrl + data.paddleskin_image_right;
                this.gameSettings.ballskin_color = this.userProfile?.ballskin_color;
                this.gameSettings.ballskin_image = this.userProfile?.ballskin_image;
                this.gameSettings.gamebackground_color = this.userProfile?.gamebackground_color;
                this.gameSettings.gamebackground_wallpaper = this.userProfile?.gamebackground_wallpaper;

                this.userProfileService.getProfile().subscribe(
                  (profile) => {
                    this.userProfile = profile;
                    this.isHost = this.userProfile?.username === this.host;
                    if (this.host === '') {
                      this.router.navigate(['/games/online-pvp/rooms']);
                    }
                  },
                  (error) => {
                    console.error('Error fetching user profile:', error);
                    this.router.navigate(['/games/online-pvp/rooms']);
                  }
                );
              },
              (error) => {
                console.error('Error fetching room status:', error);
                this.router.navigate(['/games/online-pvp/rooms']);
              }
            );
          }
        }
      );
      },
      error: (error) => {
        console.error('Error joining room:', error);
        this.router.navigate(['/games/online-pvp/rooms']);
      }
    });
  }

  joinRoom() {
    this.lobbyService.joinRoom(this.roomId).subscribe();
  }

  get isReady(): boolean {
    return this.isHost ? this.isHostReady : this.isGuestReady;
  }


  startGame() {
    if (this.userProfile?.username === this.host) {
      this.lobbyService.sendMessage({
        action: 'start_game',
        room_id: this.roomId
      });
    }
  }

  copyLinkToClipboard(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  toggleReady() {
    if (!this.userProfile) return;
    const isHost = this.userProfile?.username === this.host;
    const newReadyStatus = isHost ? !this.isHostReady : !this.isGuestReady;
    this.lobbyService.setReadyStatus(this.roomId, newReadyStatus, this.userProfile.id).subscribe(
      () => {
        this.lobbyService.sendMessage({
          action: 'set_ready',
          room_id: this.roomId,
          user_id: this.userProfile?.id,
          is_ready: newReadyStatus
        });
      },
      (error) => {
        console.error('Error setting ready status:', error);
        this.router.navigate(['/games/online-pvp/rooms']);
      }
    );
  }

  // Send keystrokes to backend
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    this.lobbyService.sendMessage({
      action: 'keydown',
      key: event.code,
      room_id: this.roomId,
      user_id: this.userProfile?.id
    });
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.lobbyService.sendMessage({
      action: 'keyup',
      key: event.code,
      room_id: this.roomId,
      user_id: this.userProfile?.id
    });
  }

  ngOnDestroy() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.lobbyService.disconnect();
    if(this.isHost)
    {
      this.lobbyService.deleteRoom(this.roomId).subscribe(
        () => {
          this.router.navigate(['/games/online-pvp/rooms']);
        }
      );
    }
  }

    // Listen to the window before unload event to detect page leave actions
    @HostListener('window:beforeunload', ['$event'])
    beforeUnloadHandler(event: Event) {
      if (this.isHost) {
        // Trigger room deletion if the user is the host
        this.lobbyService.deleteRoom(this.roomId).subscribe();
      }
      this.lobbyService.disconnect(); // Ensure disconnection on page leave
    }

    inviteFriend(friend_id: number)
    {
      console.log('Game invite sent');
      let gameInvitePayload: SendGameInvitePayload = {
        room_id: this.roomId,
        receiver_id: friend_id
      };
      this.notificationService.sendGameInvite(gameInvitePayload).subscribe(
        () => {
          console.log('Game invite sent successfully');
        }
      );
    }

    loadFriends(): void {
      this.friendService.getFriends().subscribe(
        (data) => {
          this.friends = data;
        },
        (error) => {
          console.error(error);
        }
      );
    }

    openInviteModal(inviteContent: TemplateRef<any>) {
      this.modalService.open(inviteContent, { size: 'lg', centered: true });
    }
}
