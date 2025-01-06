import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

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
  matchId: string;
  roomId: string;
  player1: string;
  player2: string;
  player1Score: number;
  player2Score: number;
  winner?: string; // need no matchOutcome, bcs winner only set when match complete, no tie, just play until one wins
  state: 'pending' | 'ongoing' | 'completed';
}

interface Round {
  roomId: string;
  roundName: string;
  roundIndex: number;
  state: 'pending' | 'ongoing' | 'completed';
  matches: (Match)[];
  winners?: string[];
  //maybe add: players, winners
}

interface Player {
  playerId: string;
  playerName: string;
}

interface Tournament {
  roomId: string;
  tournamentName: string;
  tournamentType: string;
  state: 'pending' | 'ongoing' | 'completed';
  rounds: (Round | null)[];
  players: Player[];
  currentRound: number;
  totalRounds: number;
  winner?: Player;
}

@Component({
  selector: 'app-tournament-tree',
  templateUrl: './tournament-tree.component.html',
  styleUrls: ['./tournament-tree.component.scss']
})
export class TournamentTreeComponent implements OnInit {
  tournament: Tournament | null = null;
  roomId: string = '';

  constructor(private router: Router, private route: ActivatedRoute) { }

  //try to get the connection to backend and display the tournament tree
  ngOnInit(): void {
    this.roomId = this.route.snapshot.params['roomId'] || '';
    this.tournament = this.dummyData();
    //TODO connect to tournament websocket to get tournament data.
    //TODO display the tournament tree
    //TODO send ready message to backend so the first game can start
    // games will jsut overlay over the tournament tree
  }

  dummyData(): Tournament {
    console.log('dummyData');
    return {
      roomId: '123',
      tournamentName: 'Tournament 1',
      tournamentType: TournamentType.SINGLE_ELIMINATION,
      state: 'ongoing',
      rounds: [
        {
          roomId: '123',
          roundName: Stage.PRELIMINARIES,
          roundIndex: 1,
          state: 'completed',
          matches: [
            {
              matchId: '1',
              roomId: '123',
              player1: 'Player 1',
              player2: 'Player 2',
              player1Score: 2,
              player2Score: 1,
              winner: 'Player 1',
              state: 'completed'
            },
            {
              matchId: '2',
              roomId: '123',
              player1: 'Player 3',
              player2: 'Player 4',
              player1Score: 1,
              player2Score: 2,
              winner: 'Player 4',
              state: 'completed'
            }
          ]
        },
        {
          roomId: '123',
          roundName: Stage.QUARTER_FINALS,
          roundIndex: 2,
          state: 'ongoing',
          matches: [
            {
              matchId: '3',
              roomId: '123',
              player1: 'Player 1',
              player2: 'Player 4',
              player1Score: 0,
              player2Score: 0,
              state: 'ongoing'
            }
          ]
        },
        {
          roomId: '123',
          roundName: Stage.SEMI_FINALS,
          roundIndex: 3,
          state: 'pending',
          matches: [
            {
              matchId: '4',
              roomId: '123',
              player1: 'Player 1',
              player2: 'Player 4',
              player1Score: 0,
              player2Score: 0,
              state: 'pending'
            }
          ]
        },
        null
      ],
      players: [
        {
          playerId: '1',
          playerName: 'Player 1'
        },
        {
          playerId: '2',
          playerName: 'Player 2'
        },
        {
          playerId: '3',
          playerName: 'Player 3'
        },
        {
          playerId: '4',
          playerName: 'Player 4'
        }
      ],
      currentRound: 2,
      totalRounds: 4,
    };
  }
}
