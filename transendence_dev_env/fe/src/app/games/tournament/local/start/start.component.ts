
import { Component, ComponentFactoryResolver, OnInit, ViewChild, ViewContainerRef } from '@angular/core';
import { PveGameCanvasComponent } from '../pve-game-canvas/pve-game-canvas.component';
import { PvpGameCanvasComponent } from '../pvp-game-canvas/pvp-game-canvas.component';

export enum TournamentType {
  SINGLE_ELIMINATION = 'Single Elimination',
  ROUND_ROBIN = 'Round Robin',
}

export enum Stage {
  WINNERS_ROUND = 'Winners Round',
  LOSERS_ROUND = 'Losers Round',
  FINALS = 'Finals',
}

export enum RoundType {
  FIRST_ROUND = 'First Round',
  SECOND_ROUND = 'Second Round',
  SEMI_FINAL = 'Semi-Final',
  FINAL = 'Final',
}

export enum MatchOutcome {
  FINISHED = 'Finished',
  TIE = 'Tie',
}

interface Match {
  player1: string;
  player1Type: 'Player' | 'Bot';
  player2: string;
  player2Type: 'Player' | 'Bot';
  winner: string | null;
  winnerType: 'Player' | 'Bot' | null;
  outcome: MatchOutcome | null;
  player1Score?: number;
  player2Score?: number;
  tieResolved?: boolean; // New property to show if a tie was resolved
}

interface Round {
  roundNumber: number;
  matches: Match[];
  stage: Stage;
  roundType: RoundType;
}

interface Tournament {
  name: string;
  type: TournamentType;
  rounds: Round[];
  finalWinner: string | null;
  finalWinnerType: 'Player' | 'Bot' | null;
}


@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss']
})
export class StartComponent implements OnInit {
  tournamentName: string = 'New Tournament';
  selectedTournamentType: string = '';
  playerCountOptions: number[] = [];
  maxPlayers: number = 0;
  playersSet: boolean = false;
  slots: { isBot: boolean; name: string }[] = [];
  selectedTournamentDescription: string = '';
  tournamentResults: Match[] = [];
  finalTournament: Tournament | null = null;
  currentMatchDisplay: string = '';
  @ViewChild('gameCanvasContainer', { read: ViewContainerRef }) gameCanvasContainer!: ViewContainerRef;
  tournamentTypes = [
    { 
      type: 'Single Elimination',
      description: 'Players compete in single-elimination matches. Losers are eliminated, and winners advance until a champion is crowned.',
      allowedCounts: [4, 8, 16, 32]
    },
    { 
      type: 'Round Robin',
      description: 'Each player competes against every other player. The player with the most wins is the champion.',
      allowedCounts: [4, 6, 8, 10, 12]
    }
  ];

  bracket: Round[] = [];
  roundRobinMatches: Match[] = [];

  constructor(private resolver: ComponentFactoryResolver) { }

  ngOnInit(): void {
    // Initialize default settings if needed
  }

  onTournamentTypeChange(): void {
    const selectedType = this.tournamentTypes.find(type => type.type === this.selectedTournamentType);
    this.playerCountOptions = selectedType ? selectedType.allowedCounts : [];
    this.maxPlayers = this.playerCountOptions[0] || 0; 
    this.selectedTournamentDescription = selectedType ? selectedType.description : '';
    this.initializeSlots();
  }

  initializeSlots(): void {
    this.slots = Array.from({ length: this.maxPlayers }, (_, i) => ({
        isBot: true,
        name: `Bot ${i + 1}`, // Set default name for bots
    }));
}


  buildBracket(): void {
    switch (this.selectedTournamentType) {
      case TournamentType.SINGLE_ELIMINATION:
        this.buildSingleEliminationBracket();
        break;
      case TournamentType.ROUND_ROBIN:
        this.buildRoundRobinMatches();
        break;
      default:
        console.error('Unknown tournament type');
    }
  }

  buildSingleEliminationBracket(): void {
    const rounds = Math.log2(this.maxPlayers);
    this.bracket = [];

    // First round with initial players
    const firstRoundMatches: Match[] = [];
    for (let i = 0; i < this.maxPlayers; i += 2) {
      firstRoundMatches.push({
        player1: this.slots[i].name,
        player1Type: this.slots[i].isBot ? 'Bot' : 'Player',
        player2: this.slots[i + 1]?.name,
        player2Type: this.slots[i + 1]?.isBot ? 'Bot' : 'Player',
        winner: null,
        winnerType: null,
        outcome: null,
      });
    }
    this.bracket.push({
      roundNumber: 1,
      matches: firstRoundMatches,
      stage: Stage.WINNERS_ROUND,
      roundType: RoundType.FIRST_ROUND,
    });

    // Subsequent rounds
    for (let round = 1; round < rounds; round++) {
      const previousRoundMatches = this.bracket[round - 1].matches;
      const roundMatches: Match[] = [];
      for (let i = 0; i < previousRoundMatches.length; i += 2) {
        roundMatches.push({
          player1: '',
          player1Type: 'Player',
          player2: '',
          player2Type: 'Player',
          winner: null,
          winnerType: null,
          outcome: null,
        });
      }
      const roundType = round === rounds - 1 ? RoundType.FINAL : round === rounds - 2 ? RoundType.SEMI_FINAL : RoundType.SECOND_ROUND;
      this.bracket.push({
        roundNumber: round + 1,
        matches: roundMatches,
        stage: Stage.WINNERS_ROUND,
        roundType: roundType,
      });
    }
  }

  propagateWinnersToNextRound(roundIndex: number): void {
    const currentRound = this.bracket[roundIndex];
    const nextRound = this.bracket[roundIndex + 1];
    currentRound.matches.forEach((match, matchIndex) => {
      const nextRoundMatchIndex = Math.floor(matchIndex / 2);
      if (matchIndex % 2 === 0) {
        nextRound.matches[nextRoundMatchIndex].player1 = match.winner!;
        nextRound.matches[nextRoundMatchIndex].player1Type = match.winnerType!;
      } else {
        nextRound.matches[nextRoundMatchIndex].player2 = match.winner!;
        nextRound.matches[nextRoundMatchIndex].player2Type = match.winnerType!;
      }
    });
  }

  getLoserPlayer(matches: Match[], index: number): { name: string; type: 'Player' | 'Bot' } | null {
      const match = matches[index];
      if (!match || !match.winner) return null;
      return match.winner === match.player1
          ? { name: match.player2, type: match.player2Type }
          : { name: match.player1, type: match.player1Type };
  }

  buildRoundRobinMatches(): void {
    this.roundRobinMatches = [];
    for (let i = 0; i < this.maxPlayers; i++) {
      for (let j = i + 1; j < this.maxPlayers; j++) {
        this.roundRobinMatches.push({
          player1: this.slots[i].name,
          player1Type: this.slots[i].isBot ? 'Bot' : 'Player',
          player2: this.slots[j].name,
          player2Type: this.slots[j].isBot ? 'Bot' : 'Player',
          winner: null,
          winnerType: null,
          outcome: null,
        });
      }
    }
  }

  setPlayers(): void {
    this.playersSet = true;
    this.buildBracket();
    this.simulateTournament();
  }

  async simulateMatch(match: Match): Promise<void> {
    match.player1Score = 0; // Initialize player1Score to 0
    match.player2Score = 0; // Initialize player2Score to 0
    
    // Show alert if a human is playing in this match
    if (match.player1Type === 'Player' || match.player2Type === 'Player') {
      alert(`Next Match: ${match.player1} (Player: ${match.player1Type}) vs ${match.player2} (Player: ${match.player2Type})`);
    }
    
    if (match.player1Type === 'Bot' && match.player2Type === 'Bot') {
      this.autoSimulateMatch(match);
    } else if (match.player1Type === 'Player' && match.player2Type === 'Bot') {
      await this.loadPveGameCanvas(match);
    } else if (match.player1Type === 'Player' && match.player2Type === 'Player') {
      await this.loadPvpGameCanvas(match);
    }
  }

  autoSimulateMatch(match: Match): void {
    // Logic for automatically simulating bot vs. bot matches...
    match.player1Score = Math.floor(Math.random() * 10);
    match.player2Score = Math.floor(Math.random() * 10);
    if (match.player1Score > match.player2Score) {
      match.winner = match.player1;
      match.winnerType = match.player1Type;
      match.outcome = MatchOutcome.FINISHED;
    } else if (match.player2Score > match.player1Score) {
      match.winner = match.player2;
      match.winnerType = match.player2Type;
      match.outcome = MatchOutcome.FINISHED;
    } else {
      match.outcome = MatchOutcome.TIE;
      this.resolveTie(match);
    }
  }

  async loadPveGameCanvas(match: Match): Promise<void> {
    this.currentMatchDisplay = `${match.player1} (Player) vs ${match.player2} (Bot)`; // Set display text
    
    const factory = this.resolver.resolveComponentFactory(PveGameCanvasComponent);
    const componentRef = this.gameCanvasContainer.createComponent(factory);
  
    return new Promise((resolve) => {
      componentRef.instance.onScore.subscribe((scorer: 'human' | 'bot') => {
        this.updateScore(match, scorer);
      });
  
      componentRef.instance.onGameEnd.subscribe(() => {
        if (match.player1Score === match.player2Score) {
          match.outcome = MatchOutcome.TIE;
          this.resolveTie(match);
        } else if (match.player1Score! > match.player2Score!) {
          match.winner = match.player1;
          match.winnerType = match.player1Type;
          match.outcome = MatchOutcome.FINISHED;
        } else {
          match.winner = match.player2;
          match.winnerType = match.player2Type;
          match.outcome = MatchOutcome.FINISHED;
        }
  
        componentRef.destroy();
        this.currentMatchDisplay = ''; // Clear display text after match
        resolve();
      });
    });
  }

  async loadPvpGameCanvas(match: Match): Promise<void> {
    this.currentMatchDisplay = `${match.player1} (Player) vs ${match.player2} (Player)`; // Set display text
  
    const factory = this.resolver.resolveComponentFactory(PvpGameCanvasComponent);
    const componentRef = this.gameCanvasContainer.createComponent(factory);
  
    return new Promise((resolve) => {
      componentRef.instance.onScore.subscribe((scorer: 'player1' | 'player2') => {
        this.updateScore(match, scorer);
      });
  
      componentRef.instance.onGameEnd.subscribe(() => {
        if (match.player1Score === match.player2Score) {
          match.outcome = MatchOutcome.TIE;
          this.resolveTie(match);
        } else if (match.player1Score! > match.player2Score!) {
          match.winner = match.player1;
          match.winnerType = match.player1Type;
          match.outcome = MatchOutcome.FINISHED;
        } else {
          match.winner = match.player2;
          match.winnerType = match.player2Type;
          match.outcome = MatchOutcome.FINISHED;
        }
  
        componentRef.destroy();
        this.currentMatchDisplay = ''; // Clear display text after match
        resolve();
      });
    });
  }

  updateScore(match: Match, scorer: 'player1' | 'player2' | 'human' | 'bot'): void {
    if (scorer === 'player1' || scorer === 'human') {
      match.player1Score = (match.player1Score ?? 0) + 1;
    } else {
      match.player2Score = (match.player2Score ?? 0) + 1;
    }
  }

  async simulateTournament(): Promise<void> {
    const tournament: Tournament = {
      name: this.tournamentName,
      type: this.selectedTournamentType as TournamentType,
      rounds: [],
      finalWinner: null,
      finalWinnerType: null,
    };

    if (this.selectedTournamentType === TournamentType.SINGLE_ELIMINATION) {
      await this.simulateSingleElimination(tournament);
    } else if (this.selectedTournamentType === TournamentType.ROUND_ROBIN) {
      await this.simulateRoundRobin(tournament);
    }

    this.finalTournament = tournament;
    console.log("Final Tournament Result:", this.finalTournament);
  }

  async simulateSingleElimination(tournament: Tournament): Promise<void> {
    for (const [roundIndex, round] of this.bracket.entries()) {
      for (const match of round.matches) {
        await this.simulateMatch(match);
      }
      if (roundIndex < this.bracket.length - 1) {
        this.propagateWinnersToNextRound(roundIndex);
      }
      tournament.rounds.push(round);
    }
    const finalRound = this.bracket[this.bracket.length - 1];
    tournament.finalWinner = finalRound.matches[0].winner;
    tournament.finalWinnerType = finalRound.matches[0].winnerType;
  }

  async simulateRoundRobin(tournament: Tournament): Promise<void> {
    const scores = new Map<string, number>();
    for (const match of this.roundRobinMatches) {
      await this.simulateMatch(match);
      if (match.winner) {
        scores.set(match.winner, (scores.get(match.winner) || 0) + 1);
      }
    }

    tournament.rounds.push({
      roundNumber: 1,
      matches: this.roundRobinMatches,
      stage: Stage.WINNERS_ROUND,
      roundType: RoundType.FIRST_ROUND,
    });

    const [winner] = Array.from(scores.entries()).reduce((a, b) => (a[1] > b[1] ? a : b));
    tournament.finalWinner = winner;
    tournament.finalWinnerType = this.slots.find(slot => slot.name === winner)?.isBot ? 'Bot' : 'Player';
  }
  resolveTie(match: Match): void {
    // Decide a tiebreaker winner randomly
    if (Math.random() < 0.5) {
        match.winner = match.player1;
        match.winnerType = match.player1Type;
    } else {
        match.winner = match.player2;
        match.winnerType = match.player2Type;
    }
    match.outcome = MatchOutcome.FINISHED;
    match.tieResolved = true; // Track if the match was a tie and resolved
}
  selectTournamentType(type: any): void {
    this.selectedTournamentType = type.type;
    this.selectedTournamentDescription = type.description;
    this.playerCountOptions = type.allowedCounts;
    this.maxPlayers = this.playerCountOptions[0] || 0;
    this.initializeSlots();
}

selectPlayerCount(count: number): void {
    this.maxPlayers = count;
    this.initializeSlots();
}
updateSlotName(slot: { isBot: boolean; name: string }, index: number): void {
  slot.name = slot.isBot ? `Bot ${index + 1}` : ''; // Reset to default or empty for manual entry
}
}