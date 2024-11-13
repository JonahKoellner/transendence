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

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  display_name: string;
  value: number;
}

export interface UserStats {
  user_id: number;
  username: string;
  display_name: string;
  level: number;
  xp: number;
  total_games_played: number;
  total_games_pve: number;
  total_games_pvp_local: number;
  total_games_pvp_online: number;
  total_games_won: number;
  total_games_lost: number;
  average_game_duration: number;
  total_tournaments_participated: number;
  total_tournaments_won: number;
  average_tournament_duration: number;
  
  // Ranking Fields
  rank_by_xp: number;
  rank_by_wins: number;
  rank_by_games_played: number;
  rank_by_tournament_wins: number;
}

export interface GlobalStats {
  total_users: number;
  total_games: number;
  total_pve_games: number;
  total_pvp_local_games: number;
  total_pvp_online_games: number;
  total_tournaments: number;
  completed_tournaments: number;
  average_games_per_user: number;
  average_tournaments_per_user: number;
  average_game_duration: number;
  average_tournament_duration: number;
  
  // Leaderboards
  leaderboard_xp: LeaderboardEntry[];
  leaderboard_most_wins: LeaderboardEntry[];
  leaderboard_most_games: LeaderboardEntry[];
  leaderboard_most_tournament_wins: LeaderboardEntry[];
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private apiUrl = 'http://localhost:8000/games/games/';
  private tournamentApiUrl = 'http://localhost:8000/games/tournaments/';
  private statsApiUrl = 'http://localhost:8000/games/stats/';
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

    getUserStats(userId: number): Observable<UserStats> {
      const url = `${this.statsApiUrl}${userId}/user-stats/`;
      return this.http.get<UserStats>(url, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error(`Error fetching stats for user ${userId}:`, error);
          return of({} as UserStats);
        })
      );
    }
  
    /**
     * Fetch global statistics.
     * @returns Observable of GlobalStats.
     */
    getGlobalStats(): Observable<GlobalStats> {
      const url = `${this.statsApiUrl}global-stats/`;
      return this.http.get<GlobalStats>(url, { headers: this.getHeaders() }).pipe(
        catchError((error) => {
          console.error('Error fetching global stats:', error);
          return of({} as GlobalStats);
        })
      );
    }
}