import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, throwError } from 'rxjs';

export interface GameStats {
  username: string;               // Username of the player
  total_wins: number;             // Total games won by the player
  total_games_played: number;     // Total games played by the player
  avg_score: number;              // Average score of the player across games
  win_rank: number;               // Rank of the player in terms of total wins
  game_rank: number;              // Rank of the player in terms of total games played
  avg_score_rank: number;         // Rank of the player in terms of average score
}

export interface TournamentStats {
  username: string;                       // Username of the player
  total_tournaments_won: number;          // Total tournaments won by the player
  total_tournaments_participated: number; // Total tournaments participated in by the player
  win_rank: number;                       // Rank of the player in terms of tournament wins
  participation_rank: number;             // Rank of the player in terms of tournament participation
}

@Injectable({
  providedIn: 'root'
})
export class StatsAnalyticsService {
  private baseUrl = 'http://localhost:8000/games'; // Adjust base URL as needed

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    // Include authorization token if available
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMsg: string;
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMsg = `Client error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMsg = `Server error (Status: ${error.status}): ${error.message}`;
    }
    console.error(errorMsg); // Log to console (can be logged to a server if needed)
    return throwError(() => new Error('Something went wrong; please try again later.'));
  }

  // TournamentStatisticsViewSet endpoints
  getTournamentOverview(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/overview/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getPlayerPerformance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/player-performance/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getHistoricalPerformance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/historical-performance/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getRoundDifficultyAnalysis(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/round-difficulty-analysis/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getAdvancedScoringAnalytics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/advanced-scoring-analytics/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentParticipationMetrics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/tournament-participation-metrics/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getAdvancedStageAnalytics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/advanced-stage-analytics/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentTypePerformance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/tournament-type-performance/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTimeBasedPerformance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/time-based-performance/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getRoundBasedAnalysis(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/round-based-analysis/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getStagePerformance(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/stage-performance/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentTypeBreakdown(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/tournament-type-breakdown/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getMatchOutcomes(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-statistics/match-outcomes/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // GameLeaderboardSet endpoints
  getGameLeaderboardTotalWins(): Observable<any> {
    return this.http.get(`${this.baseUrl}/game-leaderboard/leaderboard_total_wins/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getGameLeaderboardTotalGamesPlayed(): Observable<any> {
    return this.http.get(`${this.baseUrl}/game-leaderboard/leaderboard_total_games_played/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getGameLeaderboardAvgScore(): Observable<any> {
    return this.http.get(`${this.baseUrl}/game-leaderboard/leaderboard_avg_score/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getGameLeaderboardTopScores(): Observable<any> {
    return this.http.get(`${this.baseUrl}/game-leaderboard/leaderboard_top_scores/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getGameLeaderboardMostRecentGames(): Observable<any> {
    return this.http.get(`${this.baseUrl}/game-leaderboard/leaderboard_most_recent_games/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  
  // TournamentLeaderboardViewSet endpoints
  getTournamentLeaderboardWins(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-leaderboard/leaderboard_tournament_wins/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentLeaderboardTotalTournaments(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-leaderboard/leaderboard_total_tournaments/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentLeaderboardAvgDuration(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-leaderboard/leaderboard_avg_duration/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentLeaderboardHighestScores(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-leaderboard/leaderboard_highest_scores/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentLeaderboardMostRecentTournaments(): Observable<any> {
    return this.http.get(`${this.baseUrl}/tournament-leaderboard/leaderboard_most_recent_tournaments/`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getTournamentLeaderboardByUser(userId: number): Observable<TournamentStats> {
    return this.http.get<TournamentStats>(`${this.baseUrl}/tournament-leaderboard/user-stats/${userId}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getGameLeaderboardByUser(userId: number): Observable<GameStats> {
      return this.http.get<GameStats>(`${this.baseUrl}/game-leaderboard/user-stats/${userId}`, { headers: this.getHeaders() })
        .pipe(catchError(this.handleError));
  }

  getAllTournamentStats(): Observable<any> {
    return forkJoin({
      overview: this.getTournamentOverview().pipe(catchError(this.handleError)),
      playerPerformance: this.getPlayerPerformance().pipe(catchError(this.handleError)),
      historicalPerformance: this.getHistoricalPerformance().pipe(catchError(this.handleError)),
      roundDifficultyAnalysis: this.getRoundDifficultyAnalysis().pipe(catchError(this.handleError)),
      advancedScoringAnalytics: this.getAdvancedScoringAnalytics().pipe(catchError(this.handleError)),
      tournamentParticipationMetrics: this.getTournamentParticipationMetrics().pipe(catchError(this.handleError)),
      advancedStageAnalytics: this.getAdvancedStageAnalytics().pipe(catchError(this.handleError)),
      tournamentTypePerformance: this.getTournamentTypePerformance().pipe(catchError(this.handleError)),
      timeBasedPerformance: this.getTimeBasedPerformance().pipe(catchError(this.handleError)),
      roundBasedAnalysis: this.getRoundBasedAnalysis().pipe(catchError(this.handleError)),
      stagePerformance: this.getStagePerformance().pipe(catchError(this.handleError)),
      tournamentTypeBreakdown: this.getTournamentTypeBreakdown().pipe(catchError(this.handleError)),
      matchOutcomes: this.getMatchOutcomes().pipe(catchError(this.handleError)),
    }).pipe(
      map(response => ({
        ...response
      })),
      catchError(this.handleError)
    );
  }

  // Merging function to get all tournament leaderboard stats
  getAllTournamentLeaderboard(): Observable<any> {
    return forkJoin({
      tournamentWins: this.getTournamentLeaderboardWins().pipe(catchError(this.handleError)),
      totalTournaments: this.getTournamentLeaderboardTotalTournaments().pipe(catchError(this.handleError)),
      avgDuration: this.getTournamentLeaderboardAvgDuration().pipe(catchError(this.handleError)),
      highestScores: this.getTournamentLeaderboardHighestScores().pipe(catchError(this.handleError)),
      mostRecentTournaments: this.getTournamentLeaderboardMostRecentTournaments().pipe(catchError(this.handleError)),
    }).pipe(
      map(response => ({
        ...response
      })),
      catchError(this.handleError)
    );
  }

  // Merging function to get all game leaderboard stats
  getAllGameLeaderboard(): Observable<any> {
    return forkJoin({
      totalWins: this.getGameLeaderboardTotalWins().pipe(catchError(this.handleError)),
      totalGamesPlayed: this.getGameLeaderboardTotalGamesPlayed().pipe(catchError(this.handleError)),
      avgScore: this.getGameLeaderboardAvgScore().pipe(catchError(this.handleError)),
      topScores: this.getGameLeaderboardTopScores().pipe(catchError(this.handleError)),
      mostRecentGames: this.getGameLeaderboardMostRecentGames().pipe(catchError(this.handleError)),
    }).pipe(
      map(response => ({
        ...response
      })),
      catchError(this.handleError)
    );
  }
}