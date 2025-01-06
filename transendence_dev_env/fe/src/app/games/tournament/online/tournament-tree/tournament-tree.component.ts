import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { NavigationStart, ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProfileService, UserProfile } from 'src/app/profile.service';
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
  type: TournamentType;
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
  ) { }

  //try to get the connection to backend and display the tournament tree
  ngOnInit(): void {
    this.roomId = this.route.snapshot.params['roomId'] || '';
    if (!this.roomId) {
      this.toastr.error('Invalid room id', 'Error');
      return ;
    }

    //join tournament and build up websocket connection
    this.tournamentService.join



    this.tournament = this.dummyData();
  }

  dummyData(): Tournament {
    console.log('dummyData');
    return {
      room_id: '123',
      name: 'Tournament 1',
      type: TournamentType.SINGLE_ELIMINATION,
      status: 'ongoing',
      rounds: [
        {
          round_number: 1,
          stage: Stage.PRELIMINARIES,
          status: 'completed',
          matches: [
            {
              match_id: '1',
              player1: 'Player 1',
              player2: 'Player 2',
              player1_score: 2,
              player2_score: 1,
              winner: 'Player 1',
              status: 'completed',
              start_time: '2024-01-01T12:00:00Z',
              end_time: '2024-01-01T12:30:00Z',
            },
            {
              match_id: '2',
              player1: 'Player 3',
              player2: 'Player 4',
              player1_score: 1,
              player2_score: 2,
              winner: 'Player 4',
              status: 'completed',
              start_time: '2024-01-01T13:00:00Z',
              end_time: '2024-01-01T13:30:00Z',
            },
          ],
          winners: ['Player 1', 'Player 4'],
          start_time: '2024-01-01T12:00:00Z',
          end_time: '2024-01-01T14:00:00Z',
        },
      ],
      participants: [
        { username: 'Player 1', id:'1', is_ready: true },
        { username: 'Player 2', id:'2', is_ready: true },
        { username: 'Player 3', id:'3', is_ready: false },
        { username: 'Player 4', id:'4', is_ready: true },
      ],
      round_robin_scores: { 'Player 1': 3, 'Player 2': 2, 'Player 3': 1, 'Player 4': 4 },
      final_winner: null,
    };
  }
}
