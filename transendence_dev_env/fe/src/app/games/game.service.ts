import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';
import { Tournament } from './tournament/local/start/start.component';

export interface Player {
  id: number | null;
  username: string;
}

export interface MoveLog {
  time: string;
  player: string;
  action: string;
}

export interface Round {
  round_number: number;
  start_time: string;
  end_time?: string;
  score_player1: number;
  score_player2: number;
  winner: string;
}

export interface Game {
  id?: number;
  game_mode: string;
  player1: Player;
  player2:  Player;
  start_time: string;
  end_time?: string;
  duration?: number;
  score_player1: number;
  score_player2: number;
  winner?: Player | null;
  is_completed: boolean;
  moves_log: MoveLog[];
  rounds: Round[];
  player2_name_pvp_local?: string;
}

export interface UserStats {
  pve_games: number;
  pvp_games: number;
  win_rate: number;
  average_duration: number;
  scores?: number[];
  avg_rounds_per_game: number;
  avg_score_per_round: number;
  monthly_performance: { [month: string]: { games: number; win_rate: number } };
  current_win_streak: number;
  max_win_streak: number;
  first_move_win_rate: number;
  performance_by_time: { [hour: string]: { games: number; win_rate: number } };
}
@Injectable({
  providedIn: 'root'
})
export class GameService {
  private apiUrl = 'http://localhost:8000/games/games/';
  private tournamentApiUrl = 'http://localhost:8000/games/tournaments/';
  constructor(private http: HttpClient) {}

  // Headers with authorization token
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`
    });
  }

  // Create a new game
  createGame(gameData: Game): Observable<Game> {
    return this.http.post<Game>(this.apiUrl, gameData, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Error creating game:', error);
        return of({} as Game);
      })
    );
  }

  // Get all games where the user is a participant
  getGames(): Observable<Game[]> {
    return this.http.get<Game[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Error fetching games:', error);
        return of([]);
      })
    );
  }

  // Get games by a specific user ID
  getGamesByUser(userId: number): Observable<Game[]> {
    return this.http.get<Game[]>(`${this.apiUrl}by-user/${userId}/`, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error(`Error fetching games for user ${userId}:`, error);
        return of([]);
      })
    );
  }

  // Get a single game by ID
  getGameById(gameId: number): Observable<Game> {
    return this.http.get<Game>(`${this.apiUrl}${gameId}/game-detail/`, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error(`Error fetching game ${gameId}:`, error);
        return of({} as Game);
      })
    );
  }

  // Update a game by ID
  updateGame(gameId: number, gameData: Partial<Game>): Observable<Game> {
    return this.http.patch<Game>(`${this.apiUrl}${gameId}/`, gameData, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error(`Error updating game ${gameId}:`, error);
        return of({} as Game);
      })
    );
  }

  // Delete a game by ID
  deleteGame(gameId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${gameId}/`, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error(`Error deleting game ${gameId}:`, error);
        return of();
      })
    );
  }
  userGameStatistics(): Observable<UserStats> {
    return this.http.get<UserStats>(`${this.apiUrl}user-stats/`, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Error fetching user game statistics:', error);
        return of();
      })
    );
  }
  createTournament(tournamentData: Tournament): Observable<Tournament> {
    return this.http.post<Tournament>(this.tournamentApiUrl, tournamentData, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Error creating tournament:', error);
        return of({} as Tournament);
      })
    );
  }
    // Get all tournaments
    getTournaments(): Observable<Tournament[]> {
      return this.http.get<Tournament[]>(this.tournamentApiUrl, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error('Error fetching tournaments:', error);
          return of([]);
        })
      );
    }

    getTournamentsByUser(userId: number): Observable<Tournament[]> {
      return this.http.get<Tournament[]>(`${this.tournamentApiUrl}by-user/${userId}/`, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error(`Error fetching games for user ${userId}:`, error);
          return of([]);
        })
      );
    }
  
    // Get a single tournament by ID
    getTournamentById(tournamentId: number): Observable<Tournament> {
      return this.http.get<Tournament>(`${this.tournamentApiUrl}${tournamentId}/`, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error(`Error fetching tournament ${tournamentId}:`, error);
          return of({} as Tournament);
        })
      );
    }
  
    // Update a tournament by ID
    updateTournament(tournamentId: number, tournamentData: Partial<Tournament>): Observable<Tournament> {
      return this.http.patch<Tournament>(`${this.tournamentApiUrl}${tournamentId}/`, tournamentData, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error(`Error updating tournament ${tournamentId}:`, error);
          return of({} as Tournament);
        })
      );
    }
  
    // Delete a tournament by ID
    deleteTournament(tournamentId: number): Observable<void> {
      return this.http.delete<void>(`${this.tournamentApiUrl}${tournamentId}/`, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error(`Error deleting tournament ${tournamentId}:`, error);
          return of();
        })
      );
    }
  
    // Get tournaments by participant
    getTournamentsByParticipant(participantName: string): Observable<Tournament[]> {
      return this.http.get<Tournament[]>(`${this.tournamentApiUrl}by-participant/?participant=${participantName}`, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error(`Error fetching tournaments for participant ${participantName}:`, error);
          return of([]);
        })
      );
    }
}