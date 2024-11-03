import { Component } from '@angular/core';
import { StatsAnalyticsService } from 'src/app/services/stats-analytics.service';

interface TournamentOverview {
  total_tournaments: number;
  ongoing_tournaments: number;
  completed_tournaments: number;
  average_duration: number;
  max_duration: number;
  min_duration: number;
  average_participants_per_tournament: number;
  average_rounds_per_tournament: number;
}

interface PlayerPerformance {
  username: string;
  win_count: number;
  loss_count: number;
  total_participations: number;
  win_rate: number;
  average_placement: number;
  longest_win_streak: number;
  average_points_per_match: number;
}

interface HistoricalPerformance {
  [month: string]: {
    total_tournaments: number;
    completed_tournaments: number;
    win_rate: number;
    average_score: number;
  };
}

interface RoundDifficulty {
  [stage: string]: {
    average_score_difference: number;
    survival_rate: number;
  };
}

interface ScoringAnalytics {
  highest_score: number;
  lowest_score: number;
  average_score_gap: number;
  score_distribution: {
    player1_score: number;
    player2_score: number;
    frequency: number;
  }[];
}

interface TournamentParticipationMetrics {
  average_rounds_per_participant: number;
  average_matches_per_participant: number;
  most_frequent_participants: {
    username: string;
    tournament_count: number;
  }[];
}

interface StageAnalytics {
  [stage: string]: {
    average_win_rate: number;
    average_score: number;
    longest_match_duration: number;
  };
}

interface TournamentTypePerformance {
  [type: string]: {
    total_tournaments: number;
    average_win_rate: number;
    average_score_gap: number;
  };
}

interface TimePeriodStats {
  count: number;
  start?: number;
  end?: number;
}

interface TimeBasedPerformance {
  morning: TimePeriodStats;
  afternoon: TimePeriodStats;
  evening: TimePeriodStats;
  night: TimePeriodStats;
  peak_time: string;
}

interface RoundBasedAnalysis {
  total_rounds: number;
  average_rounds_per_tournament: number;
  average_round_duration: number;
  most_competitive_stage: {
    stage: string;
    average_score_difference: number;
  };
}

interface StagePerformance {
  [stage: string]: {
    total_rounds: number;
    average_matches_per_round: number;
    average_duration: number;
    win_rate: number;
  };
}

interface TournamentTypeBreakdown {
  [type: string]: {
    total_tournaments: number;
    win_rate: number;
  };
}

interface MatchOutcomes {
  total_matches: number;
  completed_matches: number;
  tied_matches: number;
  tie_rate: number;
  average_score_difference: number;
  highest_scoring_match: {
    player1: string;
    player2: string;
    player1_score: number;
    player2_score: number;
  };
}

interface TournamentStats {
  overview: TournamentOverview; //done
  playerPerformance: PlayerPerformance[]; //done
  historicalPerformance: HistoricalPerformance; //done
  roundDifficultyAnalysis: RoundDifficulty; //done
  advancedScoringAnalytics: ScoringAnalytics; //done
  tournamentParticipationMetrics: TournamentParticipationMetrics; //done
  advancedStageAnalytics: StageAnalytics; //done
  tournamentTypePerformance: TournamentTypePerformance; //done
  timeBasedPerformance: TimeBasedPerformance; //done
  roundBasedAnalysis: RoundBasedAnalysis; //done
  stagePerformance: StagePerformance; //done
  tournamentTypeBreakdown: TournamentTypeBreakdown; //done
  matchOutcomes: MatchOutcomes;
}



@Component({
  selector: 'app-tournament-stats',
  templateUrl: './tournament-stats.component.html',
  styleUrls: ['./tournament-stats.component.scss']
})
export class TournamentStatsComponent {
  tournamentStats: TournamentStats | null = null;
  constructor(private statsService: StatsAnalyticsService) {}

  ngOnInit(): void {
    this.statsService.getAllTournamentStats().subscribe({
      next: (data: TournamentStats) => {
        this.tournamentStats = data;
        console.log(data);
        console.log(this.tournamentStats);
      },
      error: err => {
        console.error(err);
      }
    });
  }

  getMonths(historicalPerformance: HistoricalPerformance): string[] {
    return Object.keys(historicalPerformance);
  }
  getStages(roundDifficultyAnalysis: RoundDifficulty): string[] {
    return Object.keys(roundDifficultyAnalysis);
  }
  getStageData(stage: string): { average_score_difference: number; survival_rate: number } | null {
    const stageData = this.tournamentStats?.roundDifficultyAnalysis[stage];
    return Array.isArray(stageData) && stageData.length > 0 ? stageData[0] : null;
  }
  getStagesSa(stageAnalytics: StageAnalytics): string[] {
    return Object.keys(stageAnalytics);
  }
  getTournamentTypes(tournamentTypePerformance: TournamentTypePerformance): string[] {
    return Object.keys(tournamentTypePerformance);
  }
  getStagesSp(stagePerformance: StagePerformance): string[] {
    return Object.keys(stagePerformance);
  }
  
  getTournamentTypesTb(tournamentTypeBreakdown: TournamentTypeBreakdown): string[] {
    return Object.keys(tournamentTypeBreakdown);
  }
}
