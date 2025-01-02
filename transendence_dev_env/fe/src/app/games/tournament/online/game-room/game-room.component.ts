import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TournamentLobbyService } from 'src/app/services/tournament-lobby.service';

interface LobbyState {
  host: { username: string; ready_state: boolean };
  guests: Array<{ username: string; ready_state: boolean }>;
  all_ready: boolean;
  is_full: boolean;
  active_lobby: boolean;
  active_tournament: boolean;
  created_at: string;
  max_rounds: number;
  round_score_limit: number;
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
  isHost: boolean = false;
  currentUser: string = ''; // Replace with actual logic to fetch the logged-in user

  constructor(
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private lobbyService: TournamentLobbyService
  ) {}

  ngOnInit(): void {
    // Fetch the room ID from the route
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    if (!this.roomId) {
      this.toastr.error('Invalid room ID.', 'Error');
      return;
    }

    // Join the room and connect to WebSocket
    this.joinRoom();
  }

  ngOnDestroy(): void {
    this.lobbyService.disconnect();
    if (this.isHost) {
      this.lobbyService.deleteRoom(this.roomId).subscribe(
        () => this.toastr.info('Room deleted successfully.', 'Info'),
        (err) => this.toastr.error('Failed to delete the room.', 'Error')
      );
    }
  }

  private joinRoom(): void {
    this.lobbyService.joinRoom(this.roomId).subscribe({
      next: () => {
        this.lobbyService.connect(this.roomId);

        // Listen for WebSocket messages
        this.lobbyService.messages$.subscribe({
          next: (msg) => this.handleWebSocketMessage(msg),
          error: (err) => {
            this.toastr.error('WebSocket connection failed.', 'Error');
            console.error(err);
          },
        });

        // Fetch the initial room state
        this.fetchRoomStatus();
      },
      error: (err) => {
        this.toastr.error('Failed to join the room.', 'Error');
        console.error(err);
      },
    });
  }

  private fetchRoomStatus(): void {
    this.lobbyService.getRoomStatus(this.roomId).subscribe({
      next: (data: LobbyState) => {
        this.lobbyState = data;
        this.isHost = this.lobbyState.host.username === this.currentUser;
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
        this.lobbyState = msg.state;
        this.isHost = this.lobbyState?.host.username === this.currentUser;
        break;
      case 'ready_status':
        if (this.lobbyState) {
          this.lobbyState.guests = msg.guests;
          this.lobbyState.all_ready = msg.all_ready;
        }
        break;
      case 'game_started':
        this.toastr.success('The game has started!', 'Success');
        break;
      case 'alert':
        this.handleAlert(msg);
        break;
      default:
        console.warn('Unhandled WebSocket message type:', msg.type);
    }
  }

  private handleAlert(msg: any): void {
    if (msg.user_role === 'host') {
      this.toastr.error('The host has left the room.', 'Error');
    } else if (msg.user_role === 'guest') {
      this.toastr.info(`Player ${msg.username} has left the room.`, 'Info');
    }
    this.fetchRoomStatus();
  }

  toggleReadyStatus(): void {
    const isReady = !this.getCurrentUserReadyStatus();
    this.lobbyService.setReadyStatus(this.roomId, isReady, this.getCurrentUserId()).subscribe({
      next: () => {
        this.lobbyService.sendMessage({
          action: 'set_ready',
          room_id: this.roomId,
          is_ready: isReady,
          user_id: this.getCurrentUserId(),
        });
        this.toastr.success(`You are now ${isReady ? 'ready' : 'not ready'}.`, 'Status Updated');
      },
      error: (err) => {
        this.toastr.error('Failed to update ready status.', 'Error');
        console.error(err);
      },
    });
  }

  updateSettings(maxRounds?: string, roundScoreLimit?: string, tournamentType?: string): void {
    if (!this.isHost) {
      this.toastr.error('Only the host can update settings.', 'Permission Denied');
      return;
    }
  
    const settings: any = {};
    if (maxRounds) settings.max_rounds = Number(maxRounds);
    if (roundScoreLimit) settings.round_score_limit = Number(roundScoreLimit);
    if (tournamentType) settings.tournament_type = tournamentType;
  
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

    this.lobbyService.sendMessage({ action: 'start_tournament' });
    this.toastr.info('Tournament is starting...', 'Info');
  }

  private getCurrentUserId(): number {
    // Replace with logic to fetch the current user's ID
    return 1;
  }

  public getCurrentUserReadyStatus(): boolean {
    if (this.lobbyState) {
      if (this.isHost) return this.lobbyState.host.ready_state;
      const guest = this.lobbyState.guests.find((g) => g.username === this.currentUser);
      return guest ? guest.ready_state : false;
    }
    return false;
  }

  copyLinkToClipboard(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.toastr.success('Link copied to clipboard!', 'Success');
    }).catch(err => {
      this.toastr.error('Failed to copy link to clipboard!', 'Error');
    });
  }
}
