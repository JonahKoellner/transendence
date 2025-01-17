import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { NavigationStart, ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { TournamentLobbyService } from 'src/app/services/tournament-lobby.service';
import { forkJoin, Subscription } from 'rxjs';

//BACKLOG:
//TODO: friend list / friends in general
//TODO: invite

interface LobbyState {
  host: string;
  host_id: number;
  guests: Array<{ username: string; id: number; ready_state: boolean }>;
  all_ready: boolean;
  is_full: boolean;
  active_lobby: boolean;
  active_tournament: boolean;
  created_at: string;
  max_player_count: number;
  // round_score_limit: number;
  room_id: string;
  tournament_type: string;
}

@Component({
  selector: 'app-game-room',
  templateUrl: './game-room.component.html',
  styleUrls: ['./game-room.component.scss'],
})
export class GameRoomComponent implements OnInit, OnDestroy {
  roomId: string = '';
  lobbyState: LobbyState | null = null;
  private messageSubscription!: Subscription;
  isReady: boolean = false;
  userProfile: UserProfile | null = null;
  private navigationSubscription!: Subscription;
  private goingToTournament: boolean = false; // to detect next route -> not leave the lobby if its the tournament
  guestCount: number = 0;
  tournamentTypes = [
    { 
      type: 'Single Elimination',
      description: 'Players compete in single-elimination matches. Losers are eliminated, and winners advance until a champion is crowned.',
      allowedCounts: [4, 8, 16, 32]
    },
    { 
      type: 'Round Robin',
      description: 'Each player competes against every other player. The player with the most wins is the champion.',
      allowedCounts: [4, 6, 8, 10, 12]
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
    private lobbyService: TournamentLobbyService,
    private userProfileService: ProfileService,
  ) {}


  ngOnInit(): void {
    // Fetch the room ID from the route
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    if (!this.roomId) {
      this.toastr.error('Invalid room ID.', 'Error');
      return;
    }

    this.navigationSubscription = this.router.events.subscribe(event => { // to not delete lobby when going to tournament tree
      if (event instanceof NavigationStart) {
        if (event.url.startsWith('/games/online-tournament/tournament-tree')) {
          console.log('Going to tournament tree');
          this.goingToTournament = true;
        }
      }
    });
    // Fetch both userProfile and lobbyState in parallel
    forkJoin({
      userProfile: this.userProfileService.getProfile(),
      lobbyState: this.lobbyService.getRoomStatus(this.roomId),
    }).subscribe({
      next: ({ userProfile, lobbyState }: { userProfile: UserProfile; lobbyState: LobbyState }) => {
        this.userProfile = userProfile;
        this.lobbyState = lobbyState;
        console.log('Assigned lobby state', this.lobbyState)
      },
      error: (err) => {
        this.toastr.error('Failed to load game room data.', 'Error');
        console.error(err);
        this.router.navigate(['/games/online-tournament/rooms']);
      },
    });

    // Join the room and connect to WebSocket
    this.joinRoom();
  }

  ngOnDestroy(): void {
    console.log('Destroying game room component, goingToTournament:', this.goingToTournament);
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.lobbyService.disconnect();
    if (this.isHost && !this.goingToTournament) { // only delete room if not navigating to the tournament tree
      this.lobbyService.deleteRoom(this.roomId).subscribe(
        () => {
          this.toastr.info('Room deleted successfully.', 'Info')
          this.router.navigate(['/games/online-tournament/rooms']);
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

  // Getters for binding in HTML
  get host(): string {
    return this.lobbyState?.host || '';
  }

  get guests(): Array<{ username: string; id: number; ready_state: boolean }> {
    return this.lobbyState?.guests || [];
  }

  get allReady(): boolean {
    return this.lobbyState?.all_ready || false;
  }

  get maxPlayerCount(): number {
    return this.lobbyState?.max_player_count || 0;
  }

  get tournamentType(): string {
    return this.lobbyState?.tournament_type || '';
  }

  get isHost(): boolean {
    return this.userProfile?.id === this.lobbyState?.host_id;
  }

  get isFull(): boolean {
    return this.lobbyState?.is_full || false;
  }

  get tournamentDescription(): string {
    const selectedType = this.tournamentTypes.find(type => type.type === this.tournamentType);
    return selectedType ? selectedType.description : '';
  }

  get playerCountOptions(): number[] {
    const selectedType = this.tournamentTypes.find(type => type.type === this.tournamentType);
    return selectedType ? selectedType.allowedCounts : [];
  }

  get maxPlayers(): number {
    return this.lobbyState?.max_player_count || 0;
  }

  private joinRoom(): void {
    this.lobbyService.joinRoom(this.roomId).subscribe({
      next: () => {
        this.lobbyService.connect(this.roomId);
        
        // Fetch the initial room state
        this.fetchRoomStatus();

        // Listen for WebSocket messages
        this.messageSubscription = this.lobbyService.messages$.subscribe({
          next: (msg) => this.handleWebSocketMessage(msg),
          error: (err) => {
            this.toastr.error('An error occurred while fetching room status. Redirecting you to the lobby.', 'Error');
            this.router.navigate(['/games/online-tournament/rooms']);
          },
        });

      },
      error: (err) => {
        this.toastr.error('An error occurred while joining the room. Redirecting you to the lobby.', 'Error');
        this.router.navigate(['/games/online-tournament/rooms']);
      },
    });
  }

  private fetchRoomStatus(): void {
    console.log('Fetching room status')
    this.lobbyService.getRoomStatus(this.roomId).subscribe({
      next: (data: LobbyState) => {
        if (data) {
          this.lobbyState = data;
        }
        console.log('Assigned lobby state in fetchRoomStatus', this.lobbyState)
        this.userProfileService.getProfile().subscribe(
          (profile) => {
            this.userProfile = profile;
            if (this.host === '') {
              this.router.navigate(['/games/online-tournament/rooms']);
            }
          },
          (error) => {
            this.toastr.error('An error occurred while fetching user profile. Redirecting you to the lobby.', 'Error');
            this.router.navigate(['/games/online-tournament/rooms']);
          }
        );
      },
      error: (err) => {
        this.toastr.error('Failed to fetch room status.', 'Error');
        console.error(err);
      },
    });
  }

  private handleWebSocketMessage(msg: any): void {
    switch (msg.type) {
      case 'lobby_state':
        console.log('assigning new lobbyState', msg)
        this.lobbyState = msg.lobby_state;
        break;
      case 'ready_status':
        if (this.lobbyState) {
          this.lobbyState.guests = msg.guests;
          this.lobbyState.all_ready = msg.all_ready;
        }
        break;
      case 'tournament_start':
        console.log('Navigating to tournament tree');
        this.router.navigate(['/games/online-tournament/tournament-tree', this.roomId]);
        this.lobbyService.disconnect();
        break;
      case 'alert':
        console.log('Alert message', msg);
        this.handleAlert(msg);
        break;
      default:
        console.warn('Unhandled WebSocket message type:', msg.type);
    }
    if (this.host === "") {
      this.router.navigate(['/games/online-tournament/rooms']);
    }
    // if (msg.type !== 'lobby_state') {
    //   this.fetchRoomStatus();
    // }
  }

  private handleAlert(msg: any): void {
    if (msg.user_role === 'host') {
      this.toastr.error(msg.message, 'Error');
      this.router.navigate(['/games/online-tournament/rooms']);
    } else if (msg.user_role === 'guest') {
      this.toastr.info(msg.message, 'Info');
    }
  }

  toggleReadyStatus(): void {
    this.isReady = !this.isReady;
    console.log('isReady:', this.isReady);
      this.lobbyService.setReadyStatus(this.roomId, this.isReady).subscribe({
      next: () => {
        this.lobbyService.sendMessage({
          action: 'set_ready',
          room_id: this.roomId,
          is_ready: this.isReady,
        });
        this.toastr.success(`You are now ${this.isReady ? 'ready' : 'not ready'}.`, 'Status Updated');
      },
      error: (err) => {
        this.toastr.error('Failed to update ready status.', 'Error');
        console.error(err);
      },
    });
  }

  updateSettings(max_player_count?: number, tournament_type?: string): void {
    if (!this.isHost) {
      this.toastr.error('Only the host can update settings.', 'Permission Denied');
      return;
    }
  
    const settings: any = {};
    if (max_player_count) settings.max_player_count = max_player_count;
    if (tournament_type) settings.tournament_type = tournament_type;
  
    this.lobbyService.sendMessage({
      action: 'update_settings',
      settings,
    });
  }

  startTournament(): void {
    if (!this.isHost) {
      this.toastr.error('Only the host can start the tournament.', 'Permission Denied');
      return;
    }

    if (!this.lobbyState?.all_ready) {
      this.toastr.error('Not all players are ready.', 'Cannot Start');
      return;
    }

    if (this.lobbyState?.guests.length === 0) {
      this.toastr.error('Not enough players to start the tournament.', 'Cannot Start');
      return;
    }

    this.lobbyService.sendMessage({ action: 'start_tournament' });
    this.toastr.info('Tournament is starting...', 'Info');
  }

  copyLinkToClipboard(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.toastr.success('Link copied to clipboard!', 'Success');
    }).catch(err => {
      this.toastr.error('Failed to copy link to clipboard!', 'Error');
    });
  }

  onTournamentTypeChange(): void {
    if (this.lobbyState) {
      const selectedType = this.tournamentTypes.find(type => type.type === this.lobbyState?.tournament_type);
      this.lobbyState.tournament_type = selectedType ? selectedType.type : '';
      this.updateSettings(undefined, this.lobbyState.tournament_type);
    }
  }

  selectTournamentType(type: any): void {
    if (this.isHost && this.lobbyState) {
      this.lobbyState.tournament_type = type.type;
      this.updateSettings(undefined, type.type);
    }
  }
  
  selectMaxPlayerCount(count: number): void {
    if (this.isHost && this.lobbyState) {
      this.lobbyState.max_player_count = count;
      this.updateSettings(count, undefined);
    }
  }
}
