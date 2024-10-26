import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, of } from 'rxjs';

export interface Game {
  id?: number;
  game_mode: string;
  player1: { id: number; username: string };
  player2: { id: number; username: string } | null;
  start_time: string;
  end_time?: string;
  duration?: number;
  score_player1: number;
  score_player2: number;
  winner?: { id: number; username: string } | null;
  is_completed: boolean;
  moves_log?: Array<{ time: string; player: string; action: string }>;
  rounds?: Array<{
    round_number: number;
    start_time: string;
    end_time: string;
    score_player1: number;
    score_player2: number;
    winner: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private apiUrl = 'http://localhost:8000/games/';

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
    return this.http.post<Game>(this.apiUrl, gameData, {
      headers: this.getHeaders()
    });
  }

  // Get all games
  getGames(): Observable<Game[]> {
    return this.http.get<Game[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      catchError((error) => {
        console.error('Error fetching games:', error);
        return of([]); // Return an empty array if there's an error
      })
    );
  }

  // Get a single game by ID
  getGameById(gameId: number): Observable<Game> {
    return this.http.get<Game>(`${this.apiUrl}${gameId}/`, {
      headers: this.getHeaders()
    });
  }

  // Update a game by ID
  updateGame(gameId: number, gameData: Partial<Game>): Observable<Game> {
    return this.http.patch<Game>(`${this.apiUrl}${gameId}/`, gameData, {
      headers: this.getHeaders()
    });
  }

  // Delete a game by ID
  deleteGame(gameId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${gameId}/`, {
      headers: this.getHeaders()
    });
  }
}
