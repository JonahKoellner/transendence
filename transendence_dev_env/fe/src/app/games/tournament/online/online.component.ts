import { Component } from '@angular/core';
import { TournamentService } from '../../../services/tournament.service'
export interface User {
  id: number;
  username: string;
}

export interface OnlineMatch {
  match_id: string;
  room_id: string;
  player1?: string;
  player2?: string;
  player1_score?: number;
  player2_score?: number;
  player1_ready: boolean;
  player2_ready: boolean;
  winner?: string;
  outcome?: string;
  status: 'pending' | 'ongoing' | 'completed' | 'failed';
  start_time: string;
  end_time?: string;
  duration?: number;
  game_manager?: string;
  tie_resolved?: boolean;    // Also remember to add tie_resolved if you need it
  created_at?: string;       // If you care about created time as well
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
  id: number;               // Unique tournament ID
  room_id: string;           // Unique room ID for the tournament
  name: string;             // Tournament name
  type: 'Single Elimination' | 'Round Robin' | string; // Tournament type
  participants: User[]; // List of participants
  rounds: OnlineRound[];    // List of rounds in the tournament
  final_winner?: string;     // Username of the final winner
  round_robin_scores: Record<string, number>; // Scores for each participant
  status: 'pending' | 'ongoing' | 'completed'; // Tournament status
  current_stage: string;    // Current stage of the tournament
  created_at: string;        // ISO 8601 date string for tournament start time
  end_time: string;          // ISO 8601 date string for tournament end time
  duration: number;          // Tournament duration in seconds
}

@Component({
  selector: 'app-online',
  templateUrl: './online.component.html',
  styleUrls: ['./online.component.scss']
})
export class OnlineComponent {

}
