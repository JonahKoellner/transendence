import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TournamentService } from 'src/app/services/tournament.service';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { Subscription } from 'rxjs';

enum TournamentType {
  SINGLE_ELIMINATION = 'Single Elimination',
  ROUND_ROBIN = 'Round Robin',
}

enum Stage {
  PRELIMINARIES = 'Preliminaries',
  QUALIFIERS = 'Qualifiers',
  QUARTER_FINALS = 'Quarter Finals',
  SEMI_FINALS = 'Semi Finals',
  GRAND_FINALS = 'Grand Finals',
  ROUND_ROBIN_STAGE = 'Round Robin Stage',
}

interface Match {
  match_id: string;
  player1: string | null;
  player2: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner?: string | null;
  status: 'pending' | 'ongoing' | 'completed' | 'failed';
  outcome: 'Finished' | 'Tie' | null;
  start_time: string | null;
  end_time: string | null;
  duration: string | null;
}

interface Round {
  round_number: number;
  stage: Stage;
  status: 'pending' | 'ongoing' | 'completed';
  matches: Match[];
  winners: string[];
  start_time: string | null;
  end_time: string | null;
}

interface Player {
  username: string;
  id: string;
  is_ready: boolean;
}

interface Tournament {
  room_id: string;
  name: string;
  tournament_type: TournamentType;
  status: 'pending' | 'ongoing' | 'completed';
  rounds: Round[];
  participants: Player[];
  round_robin_scores: Record<string, number>;
  final_winner?: string | null;
  current_stage?: Stage | null;
}

@Component({
  selector: 'app-tournament-tree',
  templateUrl: './tournament-tree.component.html',
  styleUrls: ['./tournament-tree.component.scss']
})
export class TournamentTreeComponent implements OnInit, OnDestroy {
  tournament: Tournament | null = null;
  roomId: string = '';
  private messageSubscription!: Subscription;
  userProfile: UserProfile | null = null;
  gameInProgress: boolean = false;
  matchId: string = '';
  activePlayer: boolean = true;
  isLoading: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private tournamentService: TournamentService,
    private userProfileService: ProfileService,
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    // Get the room ID from the route
    this.roomId = this.route.snapshot.params['roomId'] || '';
    if (!this.roomId) {
      this.toastr.error('Invalid room id', 'Error');
      return;
    }

    this.userProfileService.getProfile().subscribe({
      next: (userProfile) => {
        this.userProfile = userProfile;
      },
      error: (err) => {
        this.toastr.error('An error occurred while fetching user data.', 'Error');
        console.error(err);
      },
    })

    // Connect to the WebSocket
    this.tournamentService.connect(this.roomId);

    // Subscribe to WebSocket messages
    this.messageSubscription = this.tournamentService.messages$.subscribe({
      next: (msg) => this.handleWebSocketMessage(msg),
      error: (err) => {
        this.toastr.error('An error occurred while fetching tournament data.', 'Error');
        console.error(err);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.tournamentService.disconnect();
    this.toastr.info('Disconnected from the tournament room.', 'Info');
    this.router.navigate(['/games/tournament/online/rooms']);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: Event) {
    this.tournamentService.disconnect(); // Ensure disconnection on page leave
    this.toastr.info('Disconnected from the tournament room.', 'Info');
    this.router.navigate(['/games/tournament/online/rooms']);
  }

  onGameEnd(): void {
    this.tournamentService.sendMessage({ action: 'game_end' });
    this.gameInProgress = false;
    this.matchId = '';
  }

  private handleWebSocketMessage(msg: any): void {
    switch (msg.type) {
      case 'tournament_state':
        this.tournament = msg.tournament_state;
        break;
      case 'join_match':
        if (msg.players.p1_id === this.userProfile?.id || msg.players.p2_id === this.userProfile?.id) {
          this.joinMatch(msg);
        }
        break;
      case 'you_lost':
        this.toastr.info('You lost the match. And are now out of the tournament', 'Info');
        this.activePlayer = false; // used to disable input and buttons
        break;
      case 'alert':
        this.toastr.info(msg.message, 'Alert');
        break;
      default:
        console.warn('Unhandled WebSocket message type:', msg.type);
    }
    this.isLoading = false;
  }

  private joinMatch(msg: any): void {
    this.matchId = msg.match_id;
    this.gameInProgress = true;
    this.toastr.info(`You have joined match ${msg.match_id}.`, 'Info');
  }

  private updateTournamentState(): void {
    if (!this.tournament) {
      return;
    }
    this.tournamentService.sendMessage({ action: 'get_tournament_state', room_id: this.roomId });
  }

  onReadyClick(): void {
    this.tournamentService.sendMessage({ action: 'ready', room_id: this.roomId });
  }

  onLeaveClick(): void {
    this.router.navigate(['/games/tournament/online/rooms']);
  }

}