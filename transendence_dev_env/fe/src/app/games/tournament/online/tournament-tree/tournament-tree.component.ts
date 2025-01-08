import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TournamentService } from 'src/app/services/tournament.service';
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
  status: 'pending' | 'ongoing' | 'completed';
  start_time: string | null;
  end_time: string | null;
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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private tournamentService: TournamentService,
  ) {}

  ngOnInit(): void {
    // Get the room ID from the route
    this.roomId = this.route.snapshot.params['roomId'] || '';
    if (!this.roomId) {
      this.toastr.error('Invalid room id', 'Error');
      return;
    }

    // Connect to the WebSocket
    this.tournamentService.connect(this.roomId);

    // Join the tournament room via WebSocket
    this.tournamentService.sendMessage({ action: 'join', room_id: this.roomId });

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
  }

  private handleWebSocketMessage(msg: any): void {
    console.log('WebSocket message:', msg);
    switch (msg.type) {
      case 'tournament_state':
        this.tournament = msg.tournament_state;
        console.log('tournament:', this.tournament);
        break;
      case 'alert':
        this.toastr.info(msg.message, 'Alert');
        this.updateTournamentState();
        break;
      default:
        console.warn('Unhandled WebSocket message type:', msg.type);
    }
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

}