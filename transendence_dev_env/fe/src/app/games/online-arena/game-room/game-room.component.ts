import { Component, OnInit, OnDestroy, HostListener, TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameLobbyArenaService } from 'src/app/services/game-lobby-arena.service';
import { Subscription } from 'rxjs';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { NotificationService, SendGameInvitePayload } from 'src/app/notifications/notification.service';
import { FriendService } from 'src/app/friend.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';
interface GameSettings {
  paddleskin_color_left?: string;
  paddleskin_image_left?: string;
  paddleskin_color_right?: string;
  paddleskin_image_right?: string;
  paddleskin_color_top?: string;
  paddleskin_image_top?: string;
  paddleskin_color_bottom?: string;
  paddleskin_image_bottom?: string;
  ballskin_color?: string;
  ballskin_image?: string;
  gamebackground_color?: string;
  gamebackground_wallpaper?: string;
}

@Component({
  selector: 'app-game-room-arena',
  templateUrl: './game-room.component.html',
  styleUrls: ['./game-room.component.scss']
})
export class GameRoomArenaComponent implements OnInit, OnDestroy {
  roomId: string = '';
  playerOne: string = '';
  playerTwo: string = 'Waiting for guest';
  playerThree: string = 'Waiting for player';
  playerFour: string = 'Waiting for player';
  isPlayerOneReady = false;
  isPlayerTwoReady = false;
  isPlayerThreeReady = false;
  isPlayerFourReady = false;
  allReady = false;
  gameInProgress = false;
  gameState: any = {};
  leftScore: number = 0;
  rightScore: number = 0;
  topScore: number = 0;
  bottomScore: number = 0;
  playerTwoID: number = 0;
  playerThreeID: number = 0;
  playerFourID: number = 0;
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
    private lobbyService: GameLobbyArenaService,
    private userProfileService: ProfileService,
    private router: Router,
    private notificationService: NotificationService,
    private friendService: FriendService,
    public modalService: NgbModal,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    this.lobbyService.joinRoom(this.roomId).subscribe({
      next: (data) => {
        this.lobbyService.connect(this.roomId);
        this.loadFriends();
        this.messageSubscription = this.lobbyService.messages$.subscribe(msg => {
          this.msgFromServer = msg;
          if (msg.type === 'initial_state') {
            this.playerOne = msg.playerOne;
            this.playerTwo = msg.playerTwo;
            this.playerThree = msg.playerThree;
            this.playerFour = msg.playerFour;
            this.playerTwoID = msg.playerTwoID;
            this.playerThreeID = msg.playerThreeID;
            this.playerFourID = msg.playerFourID;
            this.isPlayerOneReady = msg.isPlayerOneReady;
            this.isPlayerTwoReady = msg.isPlayerTwoReady;
            this.isPlayerThreeReady = msg.isPlayerThreeReady;
            this.isPlayerFourReady = msg.isPlayerFourReady;
            this.allReady = msg.allReady;
          } else if (msg.type === 'ready_status') {
            this.isPlayerOneReady = msg.isPlayerOneReady;
            this.isPlayerTwoReady = msg.isPlayerTwoReady;
            this.isPlayerThreeReady = msg.isPlayerThreeReady;
            this.isPlayerFourReady = msg.isPlayerFourReady;
            this.allReady = msg.allReady;
            this.playerOne = msg.playerOne;
            this.playerTwo = msg.playerTwo;
            this.playerThree = msg.playerThree;
            this.playerFour = msg.playerFour;
            this.playerTwoID = msg.playerTwoID;
            this.playerThreeID = msg.playerThreeID;
            this.playerFourID = msg.playerFourID;
          } else if (msg.type === 'game_state') {
            this.gameState = msg;
            this.leftScore = msg.leftScore;
            this.rightScore = msg.rightScore;
            this.topScore = msg.topScore;
            this.bottomScore = msg.bottomScore;
          } else if (msg.type === 'game_started') {
            this.gameInProgress = true;
          } else if (msg.type === 'alert') {
            // Check if the disconnecting user was the host or guest
            if (msg.user_role === 'host') {
              this.toastr.error('The host has left the game. Redirecting you to the lobby.', 'Host Disconnected');
              this.router.navigate(['/games/online-arena/rooms']);
            } else if (msg.user_role === 'guest') {
              switch (msg.user_slot) {
                case 'two':
                  this.playerTwo = 'Waiting for guest';
                  this.isPlayerTwoReady = false;
                  break;
                case 'three':
                  this.playerThree = 'Waiting for guest';
                  this.isPlayerThreeReady = false;
                  break;
                case 'four':
                  this.playerFour = 'Waiting for guest';
                  this.isPlayerFourReady = false;
                  break;
                default:
                  break;
                }
              this.allReady = false;
              if (this.gameInProgress) {
                this.toastr.error('The guest has left the game. Redirecting you to the lobby.', 'Guest Disconnected');
                this.gameInProgress = false;
                this.router.navigate(['/games/online-arena/rooms']);
              }
            }
          } else if (msg.type === 'game_ended') {
            this.gameInProgress = false;
            this.isPlayerOneReady = false;
            this.isPlayerTwoReady = false;
            this.isPlayerThreeReady = false;
            this.isPlayerFourReady = false;
            this.allReady = false;
            this.gameState = {};
            this.leftScore = 0;
            this.rightScore = 0;
            this.topScore = 0;
            this.bottomScore = 0;
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
                this.toastr.error('An error occurred while setting ready status. Redirecting you to the lobby.', 'Error');
                this.router.navigate(['/games/online-arena/rooms']);
              }
            );
            // console.log('Game over!');
            // console.log('msg:', msg);
          } else if (msg.type === 'round_completed') {
            this.toastr.info('Round completed!', 'Round Completed');
          }
          if (this.playerOne === "")
          {
            this.router.navigate(['/games/online-arena/rooms']);
          }
          if(msg.type !== 'game_state')
          {
            this.lobbyService.getRoomStatus(this.roomId).subscribe(
              (data: any) => {
                this.roomData = data;
                this.playerOne = data.player_one;
                this.playerTwo = data.player_two || 'Waiting for guest';
                this.playerThree = data.player_three || 'Waiting for guest';
                this.playerFour = data.player_four || 'Waiting for guest';
                this.isPlayerOneReady = data.is_player_one_ready;
                this.isPlayerTwoReady = data.is_player_two_ready;
                this.isPlayerThreeReady = data.is_player_three_ready;
                this.isPlayerFourReady = data.is_player_four_ready;
                this.allReady = data.all_ready;
                this.gameSettings.paddleskin_color_left = data.paddleskin_color_left;
                this.gameSettings.paddleskin_image_left = environment.apiUrl + data.paddleskin_image_left;
                this.gameSettings.paddleskin_color_right = data.paddleskin_color_right;
                this.gameSettings.paddleskin_image_right = environment.apiUrl + data.paddleskin_image_right;
                this.gameSettings.paddleskin_color_top = data.paddleskin_color_top;
                this.gameSettings.paddleskin_image_top = environment.apiUrl + data.paddleskin_image_top;
                this.gameSettings.paddleskin_color_bottom = data.paddleskin_color_bottom;
                this.gameSettings.paddleskin_image_bottom = environment.apiUrl + data.paddleskin_image_bottom;
                this.gameSettings.ballskin_color = this.userProfile?.ballskin_color;
                this.gameSettings.ballskin_image = this.userProfile?.ballskin_image;
                this.gameSettings.gamebackground_color = this.userProfile?.gamebackground_color;
                this.gameSettings.gamebackground_wallpaper = this.userProfile?.gamebackground_wallpaper;

                this.userProfileService.getProfile().subscribe(
                  (profile) => {
                    this.userProfile = profile;
                    this.isHost = this.userProfile?.username === this.playerOne;
                    if (this.playerOne === '') {
                      this.router.navigate(['/games/online-arena/rooms']);
                    }
                  },
                  (error) => {
                    this.toastr.error('An error occurred while fetching user profile. Redirecting you to the lobby.', 'Error');
                    this.router.navigate(['/games/online-arena/rooms']);
                  }
                );
              },
              (error) => {
                this.toastr.error('An error occurred while fetching room status. Redirecting you to the lobby.', 'Error');
                this.router.navigate(['/games/online-arena/rooms']);
              }
            );
          }
        }
      );
      },
      error: (error) => {
        this.toastr.error('An error occurred while joining the room. Redirecting you to the lobby.', 'Error');
        this.router.navigate(['/games/online-arena/rooms']);
      }
    });
  }

  joinRoom() {
    this.lobbyService.joinRoom(this.roomId).subscribe();
  }

  get isReady(): boolean {
    switch (this.userProfile?.username) {
      case this.playerOne:
        return this.isPlayerOneReady;
      case this.playerTwo:
        return this.isPlayerTwoReady;
      case this.playerThree:
        return this.isPlayerThreeReady;
      case this.playerFour:
        return this.isPlayerFourReady;
      default:
        return false;
    }
  }

  startGame() {
    if (this.userProfile?.username === this.playerOne) {
      this.lobbyService.sendMessage({
        action: 'start_game',
        room_id: this.roomId
      });
    }
  }

  copyLinkToClipboard(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.toastr.success('Link copied to clipboard!', 'Success');
    }).catch(err => {
      this.toastr.error('Failed to copy link to clipboard!', 'Error');
    });
  }

  toggleReady() {
    if (!this.userProfile) return;
    let newReadyStatus = false;
    if (this.userProfile.username === this.playerOne) {
      newReadyStatus = !this.isPlayerOneReady;
    } else if (this.userProfile.username === this.playerTwo) {
      newReadyStatus = !this.isPlayerTwoReady;
    }
    else if (this.userProfile.username === this.playerThree) {
      newReadyStatus = !this.isPlayerThreeReady;
    }
    else if (this.userProfile.username === this.playerFour) {
      newReadyStatus = !this.isPlayerFourReady;
    }
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
        this.toastr.error('An error occurred while setting ready status.', 'Error');
        this.router.navigate(['/games/online-arena/rooms']);
      }
    );
  }

  // Send keystrokes to backend
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.code === 'KeyW' || event.code === 'KeyS' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      this.lobbyService.sendMessage({
        action: 'keydown',
        key: event.code,
        room_id: this.roomId,
        user_id: this.userProfile?.id
      });
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    if (event.code === 'KeyW' || event.code === 'KeyS' || event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      this.lobbyService.sendMessage({
        action: 'keyup',
        key: event.code,
        room_id: this.roomId,
        user_id: this.userProfile?.id
      });
    }
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
          this.router.navigate(['/games/online-arena/rooms']);
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
      let gameInvitePayload: SendGameInvitePayload = {
        room_id: this.roomId,
        receiver_id: friend_id
      };
      this.notificationService.sendGameInviteArena(gameInvitePayload).subscribe(
        () => {
          this.toastr.success('Game invite sent!', 'Success');
        }
      );
    }

    loadFriends(): void {
      this.friendService.getFriends().subscribe(
        (data) => {
          this.friends = data;
        },
        (error) => {
          this.toastr.error('An error occurred while fetching friends.', 'Error');
        }
      );
    }

    openInviteModal(inviteContent: TemplateRef<any>) {
      this.modalService.open(inviteContent, { size: 'lg', centered: true });
    }
}
