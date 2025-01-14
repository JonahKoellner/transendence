import { Component } from '@angular/core';
import { TournamentService } from '../../../services/tournament.service'
export interface User {
  id: number;
  username: string;
}

export interface OnlineMatch {
  matchId: string;          // Unique ID for the match
  roomId: string;           // Room ID from the tournament lobby
  player1?: string;         // Username of Player 1
  player2?: string;         // Username of Player 2
  player1Score?: number;    // Score of Player 1
  player2Score?: number;    // Score of Player 2
  player1Ready: boolean;    // Indicates if Player 1 is ready
  player2Ready: boolean;    // Indicates if Player 2 is ready
  winner?: string;          // Username of the winner
  outcome?: string;         // Outcome of the match
  status: 'pending' | 'ongoing' | 'completed' | 'failed'; // Match status
  startTime: string;        // ISO 8601 date string for match start time
  endTime?: string;         // ISO 8601 date string for match end time
  duration?: number;        // Match duration in seconds
  gameManager?: string;     // Information about the game manager
}

export interface OnlineRound {
  roundNumber: number;      // Round number (e.g., 1, 2, 3)
  stage: 'Quarter Finals' | 'Semi Finals' | 'Grand Finals' | string; // Stage of the round
  matches: OnlineMatch[];   // List of matches in the round
  winners: string[];        // List of usernames of winners
  status: 'pending' | 'ongoing' | 'completed'; // Round status
  startTime: string;        // ISO 8601 date string for round start time
  endTime?: string;         // ISO 8601 date string for round end time
  duration?: number;        // Round duration in seconds
  roomId: string;           // Room ID associated with the round
}

export interface OnlineTournament {
  roomId: string;           // Unique room ID for the tournament
  name: string;             // Tournament name
  type: 'Single Elimination' | 'Round Robin' | string; // Tournament type
  participants: User[]; // List of participants
  rounds: OnlineRound[];    // List of rounds in the tournament
  finalWinner?: string;     // Username of the final winner
  roundRobinScores: Record<string, number>; // Scores for each participant
  status: 'pending' | 'ongoing' | 'completed'; // Tournament status
  currentRound: number;     // Current round number
  totalRounds: number;      // Total number of rounds
  startTime: string;        // ISO 8601 date string for tournament start time
  endTime?: string;         // ISO 8601 date string for tournament end time
}

@Component({
  selector: 'app-online',
  templateUrl: './online.component.html',
  styleUrls: ['./online.component.scss']
})
export class OnlineComponent {

}
