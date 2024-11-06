import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameLobbyService } from 'src/app/services/game-lobby.service';
import { Subscription } from 'rxjs';
import { ProfileService, UserProfile } from 'src/app/profile.service';

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
  isHost: boolean = false;
  private messageSubscription!: Subscription;
  userProfile: UserProfile | null = null;
  public msgFromServer: any;
  roomData: any;

  constructor(
    private route: ActivatedRoute,
    private lobbyService: GameLobbyService,
    private userProfileService: ProfileService,
    private router: Router
  ) {}

  ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    this.lobbyService.connect(this.roomId);

    this.messageSubscription = this.lobbyService.messages$.subscribe(msg => {
      this.msgFromServer = msg;
      if (msg.type === 'initial_state') {
        this.host = msg.host;
        this.guest = msg.guest;
        this.isHostReady = msg.isHostReady;
        this.isGuestReady = msg.isGuestReady;
        this.allReady = msg.allReady;
      } else if (msg.type === 'ready_status') {
        this.isHostReady = msg.isHostReady;
        this.isGuestReady = msg.isGuestReady;
        this.allReady = msg.allReady;
        this.host = msg.host;
        this.guest = msg.guest;
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
          alert('The guest has left the game. Waiting for a new player to join.');
        }
    }
    if (this.host === "")
      this.router.navigate(['/games/online-pvp/rooms']);
    });

    // Fetch initial state
    this.lobbyService.getRoomStatus(this.roomId).subscribe(
      (data: any) => {
        this.roomData = data;
        this.host = data.host;
        this.guest = data.guest || 'Waiting for guest';
        this.isHostReady = data.is_host_ready;
        this.isGuestReady = data.is_guest_ready;
        this.allReady = data.all_ready;
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

  startGame() {
    if (this.userProfile?.username === this.host) {
      this.lobbyService.sendMessage({
        action: 'start_game',
        room_id: this.roomId
      });
    }
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
  }
}