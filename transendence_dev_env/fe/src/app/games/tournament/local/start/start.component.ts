
import { Component, ComponentFactoryResolver, ComponentRef, HostListener, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { PveGameCanvasComponent } from '../pve-game-canvas/pve-game-canvas.component';
import { PvpGameCanvasComponent } from '../pvp-game-canvas/pvp-game-canvas.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProfileService, UserProfile } from 'src/app/profile.service';

export enum TournamentType {
  SINGLE_ELIMINATION = 'Single Elimination',
  ROUND_ROBIN = 'Round Robin',
}

export enum Stage {
  PRELIMINARIES = 'Preliminaries',
  QUALIFIERS = 'Qualifiers',
  QUARTER_FINALS = 'Quarter Finals',
  SEMI_FINALS = 'Semi Finals',
  GRAND_FINALS = 'Grand Finals',
  ROUND_ROBIN_STAGE = 'Round Robin Stage',
}

export enum MatchOutcome {
  FINISHED = 'Finished',
  TIE = 'Tie',
}

export enum TiebreakerMethod {
  TOTAL_POINTS = 'Total Points',
  MOST_WINS = 'Most Wins',
  RANDOM_SELECTION = 'Random Selection',
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
  createdAt: Date;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  status: 'pending' | 'ongoing' | 'completed' | 'failed';
}

interface Round {
  roundNumber: number;
  matches: Match[];
  stage: Stage;
  createdAt: Date;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  status: 'pending' | 'ongoing' | 'completed';
}

interface Tournament {
  name: string;
  type: TournamentType;
  rounds: Round[];
  finalWinner: string | null;
  finalWinnerType: 'Player' | 'Bot' | null;
  allParticipants?: string[];
  playersOnly?: string[];
  createdAt: Date;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  status: 'pending' | 'ongoing' | 'completed';
  winnerDeterminationMethodMessage?: string; // e.g., 'Most Wins', 'Most Points', 'Random Selection'
  tiebreakerMethod?: TiebreakerMethod;
  winnerTieResolved?: boolean; // Indicates if a tie-breaking method was applied
  host: UserProfile
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
  @ViewChild('nextMatchModal', { static: true }) nextMatchModal!: TemplateRef<any>;
  @ViewChild('matchResultModal', { static: true }) matchResultModal!: TemplateRef<any>;
  match: Match | null = null;
  player1Ready: boolean = false;
  player2Ready: boolean = false;
  isPaused: boolean = false;
  private currentGameComponentRef: ComponentRef<PveGameCanvasComponent | PvpGameCanvasComponent> | null = null;
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
  
  gameRunning: boolean = false;
  gameReady: boolean = false;
  hostname: string = '';
  host: UserProfile | null = null;
  constructor(private modalService: NgbModal, private resolver: ComponentFactoryResolver, private profileService: ProfileService ) { }

  ngOnInit(): void {
    this.profileService.getProfile().subscribe(
      profile => {
        this.hostname = profile.display_name || profile.username;
        this.host = profile;
      },
      error => {
        console.error('Failed to load profile:', error);
      }
    );
  }

  onTournamentTypeChange(): void {
    const selectedType = this.tournamentTypes.find(type => type.type === this.selectedTournamentType);
    this.playerCountOptions = selectedType ? selectedType.allowedCounts : [];
    this.maxPlayers = this.playerCountOptions[0] || 0; 
    this.selectedTournamentDescription = selectedType ? selectedType.description : '';
    this.initializeSlots();
  }

  initializeSlots(): void {
    this.slots = Array.from({ length: this.maxPlayers }, (_, i) => {
      // Set player 1 as the host and prevent them from being a bot
      if (i === 0) {
        return {
          isBot: false,
          name: this.hostname, // Set player 1 as the host
        };
      }
      return {
        isBot: true,
        name: `Bot ${i + 1}`, // Set default name for other bots
      };
    });
  }


  buildBracket(): boolean {
    switch (this.selectedTournamentType) {
      case TournamentType.SINGLE_ELIMINATION:
        this.buildSingleEliminationBracket();
        break;
      case TournamentType.ROUND_ROBIN:
        this.buildRoundRobinMatches();
        break;
      default:
        console.error('Unknown tournament type');
        return false;
    }
    return true;
  }

  buildSingleEliminationBracket(): void {
    const rounds = Math.log2(this.maxPlayers);
    this.bracket = [];
  
    // Initial round setup based on player count
    const firstRoundMatches: Match[] = [];
    for (let i = 0; i < this.maxPlayers; i += 2) {
      firstRoundMatches.push({
        player1: this.slots[i].name,
        player1Type: this.slots[i].isBot ? 'Bot' : 'Player',
        player2: this.slots[i + 1]?.name || '',
        player2Type: this.slots[i + 1]?.isBot ? 'Bot' : 'Player',
        winner: null,
        winnerType: null,
        outcome: null,
        createdAt: new Date(),
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'pending',
      });
    }
  
    // Define starting stage based on the number of players
    let startingStage: Stage;
    if (this.maxPlayers >= 32) {
      startingStage = Stage.PRELIMINARIES; // Start with Preliminaries for large tournaments
    } else if (this.maxPlayers >= 16) {
      startingStage = Stage.QUALIFIERS; // Start with Qualifiers for medium-sized tournaments
    } else if (this.maxPlayers === 8) {
      startingStage = Stage.QUARTER_FINALS;
    } else if (this.maxPlayers === 4) {
      startingStage = Stage.SEMI_FINALS;
    } else {
      throw new Error("Number of players must be a power of 2 and at least 4.");
    }
  
    // First round entry in the bracket
    this.bracket.push({
      roundNumber: 1,
      matches: firstRoundMatches,
      stage: startingStage,
      createdAt: new Date(),
      startTime: new Date(),
      endTime: null,
      duration: null,
      status: 'pending',
    });
  
    // Set up subsequent rounds
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
          createdAt: new Date(),
          startTime: new Date(),
          endTime: null,
          duration: null,
          status: 'pending',
        });
      }
  
      // Assign stages based on the round progression
      let stage: Stage;
  
      if (round === rounds - 1) {
        stage = Stage.GRAND_FINALS;
      } else if (round === rounds - 2) {
        stage = Stage.SEMI_FINALS;
      } else if (round === rounds - 3 && this.maxPlayers >= 8) {
        stage = Stage.QUARTER_FINALS;
      } else if (this.maxPlayers >= 32 && round === 1) {
        stage = Stage.QUALIFIERS; // After Preliminaries, go to Qualifiers for large tournaments
      } else {
        stage = Stage.QUALIFIERS;
      }
  
      this.bracket.push({
        roundNumber: round + 1,
        matches: roundMatches,
        stage: stage,
        createdAt: new Date(),
        startTime: new Date(),
        endTime: null,
        duration: null,
        status: 'pending',
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
          createdAt: new Date(),
          startTime: new Date(), // Will be set when the match actually starts
          endTime: null,
          duration: null,
          status: 'pending',
        });
      }
    }
  }

  goBackToSetup(): void {
    this.playersSet = false;
    this.gameReady = false;
    this.bracket = [];
    this.roundRobinMatches = [];
  }

  setPlayers(): void {
    // Collect player names (ignoring bots)
    const playerNames = this.slots
      .filter(slot => !slot.isBot)
      .map(slot => slot.name.trim());
  
    // Validate names
    const uniqueNames = new Set<string>();
    let allNamesValid = true;
  
    for (const name of playerNames) {
      if (name.length < 2 || name.length > 100) {
        allNamesValid = false;
        console.error(`Player name "${name}" must be between 2 and 100 characters.`);
        break;
      }
      if (uniqueNames.has(name)) {
        allNamesValid = false;
        console.error(`Player name "${name}" is duplicated.`);
        break;
      }
      uniqueNames.add(name);
    }
  
    // Proceed only if all names are valid
    if (allNamesValid) {
      this.playersSet = true;
      this.gameReady = this.buildBracket();
    } else {
      this.playersSet = false;
      this.gameReady = false;
      alert("Please ensure all player names are unique and between 2 to 100 characters.");
    }
  }
  startTournament(): void {
    this.resetTournamentState();
    this.simulateTournament();
  }

  resetTournamentState(): void {
    // Reset tournament-level tie resolution details
    this.finalTournament = {
      name: this.tournamentName,
      type: TournamentType.SINGLE_ELIMINATION,
      rounds: [],
      finalWinner: null,
      finalWinnerType: null,
      createdAt: new Date(),
      startTime: new Date(),
      endTime: null,
      duration: null,
      status: 'pending',
      host: this.host!
    };

    // Reset match-level tie resolution flags and scores
    this.bracket?.forEach((round) => {
      round.matches.forEach((match) => {
        match.winner = null;
        match.winnerType = null;
        match.outcome = MatchOutcome.TIE;
        match.player1Score = 0;
        match.player2Score = 0;
        match.tieResolved = false;
        match.status = 'pending';
        match.startTime = new Date();
        match.endTime = null;
        match.duration = null;
      });
    });
  
    // Clear any tournament display messages
    this.currentMatchDisplay = '';
  }
  
  goLobby()
  {
    this.resetAllVars();
    this.resetTournamentState();
  }

  resetAllVars(): void {
    this.tournamentName = 'New Tournament';
    this.playersSet = false;
    this.slots = [];
    this.selectedTournamentDescription = '';
    this.tournamentResults = [];
    this.currentMatchDisplay = '';
    this.player1Ready = false;
    this.player2Ready = false;
    this.isPaused = false;
    this.gameRunning = false;
    this.gameReady = false;
    this.playerCountOptions = [];
    this.maxPlayers = 0;
    this.bracket = [];
    this.finalTournament = null;
    this.selectedTournamentType = '';
    this.currentGameComponentRef = null;
  }
  async simulateMatch(match: Match, stage: Stage): Promise<void> {
    this.match = match;
    this.gameRunning = true;
    match.createdAt = new Date();
    match.status = 'ongoing';
    match.player1Score = 0;
    match.player2Score = 0;

    try {
        // Switch player and bot positions if player is initially player2 and bot is player1
        if (match.player1Type === 'Bot' && match.player2Type === 'Player') {
            // Swap players so the player is always on the left as player1
            [match.player1, match.player2] = [match.player2, match.player1];
            [match.player1Type, match.player2Type] = [match.player2Type, match.player1Type];
            [match.player1Score, match.player2Score] = [match.player2Score, match.player1Score];
        }

        // Handle Bot vs. Bot automatically
        if (match.player1Type === 'Bot' && match.player2Type === 'Bot') {
            this.autoSimulateMatch(match);
        } else {
            // Show the next match modal for any match involving a player
            if (match.player1Type === 'Player' || match.player2Type === 'Player') {
                await this.showNextMatchModal();
            }

            match.startTime = new Date();

            // Case 1: Player vs. Bot (player is player1, bot is player2)
            if (match.player1Type === 'Player' && match.player2Type === 'Bot') {
                await this.loadPveGameCanvas(match, stage);
            }
            // Case 2: Player vs. Player
            else if (match.player1Type === 'Player' && match.player2Type === 'Player') {
                await this.loadPvpGameCanvas(match, stage);
            }
        }

        // Mark the match as completed with duration
        match.endTime = new Date();
        match.duration = match.endTime.getTime() - match.startTime.getTime();
        match.status = 'completed';
    } catch (error) {
        console.error("Error during match simulation:", error);
        match.status = 'failed';
    } finally {
        this.gameRunning = false;
        if (match.player1Type === 'Player' || match.player2Type === 'Player') {
            await this.showMatchResultModal();
        }
    }
  }

  private async showNextMatchModal(): Promise<void> {
    this.player1Ready = false;
    this.player2Ready = false;
  
    const modalRef = this.modalService.open(this.nextMatchModal, { backdrop: 'static', keyboard: false });
    
    // Wait for modal to close before continuing
    return new Promise(resolve => {
      modalRef.closed.subscribe(() => resolve());
    });
  }

  private async showMatchResultModal(): Promise<void> {
    const modalRef = this.modalService.open(this.matchResultModal, { backdrop: 'static', keyboard: false });
    return modalRef.result;
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

  async loadPveGameCanvas(match: Match, stage: Stage): Promise<void> {
    this.currentMatchDisplay = `${match.player1} (Player) vs ${match.player2} (Bot) on ${stage}` ;
    
    const factory = this.resolver.resolveComponentFactory(PveGameCanvasComponent);
    const componentRef = this.gameCanvasContainer.createComponent(factory);
    this.currentGameComponentRef = componentRef; // Set the reference here
    
    return new Promise((resolve, reject) => {
      if (!componentRef.instance) {
        reject("PveGameCanvasComponent failed to load");
        return;
      }

      componentRef.instance.onReady.subscribe(() => {
        componentRef.instance.onScore.subscribe((scorer: 'human' | 'bot') => {
          this.updateScore(match, scorer);
        });

        componentRef.instance.onGameEnd.subscribe(() => {
          this.finalizeMatch(match, componentRef, resolve);
        });
      });
    });
  }

  async loadPvpGameCanvas(match: Match, stage: Stage): Promise<void> {
    this.currentMatchDisplay = `${match.player1} (Player) vs ${match.player2} (Player) on ${stage}` ;

    const factory = this.resolver.resolveComponentFactory(PvpGameCanvasComponent);
    const componentRef = this.gameCanvasContainer.createComponent(factory);
    this.currentGameComponentRef = componentRef; // Set the reference here

    return new Promise((resolve, reject) => {
      if (!componentRef.instance) {
        reject("PvpGameCanvasComponent failed to load");
        return;
      }

      componentRef.instance.onReady.subscribe(() => {
        componentRef.instance.onScore.subscribe((scorer: 'player1' | 'player2') => {
          this.updateScore(match, scorer);
        });

        componentRef.instance.onGameEnd.subscribe(() => {
          this.finalizeMatch(match, componentRef, resolve);
        });
      });
    });
  }
  private finalizeMatch(
    match: Match,
    componentRef: ComponentRef<any>,
    resolve: () => void
  ): void {
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
      createdAt: new Date(),
      startTime: new Date(),
      endTime: null,
      duration: null,
      status: 'ongoing',
      host: this.host!
    };
  
    if (this.selectedTournamentType === TournamentType.SINGLE_ELIMINATION) {
      await this.simulateSingleElimination(tournament);
    } else if (this.selectedTournamentType === TournamentType.ROUND_ROBIN) {
      await this.simulateRoundRobin(tournament);
    }
  
    // Set tournament's endTime, duration, and status after all rounds complete
    tournament.endTime = new Date();
    tournament.duration = tournament.endTime.getTime() - tournament.startTime.getTime();
    tournament.status = 'completed';
  
    // Collect all participants and only players
    const allParticipants = this.slots.map(slot => slot.name);
    const playersOnly = this.slots.filter(slot => !slot.isBot).map(slot => slot.name);

    // Add these arrays to the final tournament result
    this.finalTournament = {
      ...tournament,
      allParticipants,
      playersOnly,
    };

    if (this.selectedTournamentType === TournamentType.SINGLE_ELIMINATION) {
    // Check for tie resolution in the final round
    const finalRound = this.bracket[this.bracket.length - 1];
    if (finalRound && finalRound.matches && finalRound.matches.length > 0) {
      const finalMatch = finalRound.matches[0];

      // Check if the final match was resolved by a tie-breaker
      if (finalMatch.tieResolved && finalRound.stage === Stage.GRAND_FINALS && this.finalTournament.type === TournamentType.SINGLE_ELIMINATION) {
        this.finalTournament.tiebreakerMethod = TiebreakerMethod.RANDOM_SELECTION;
        this.finalTournament.winnerDeterminationMethodMessage =
          `The tournament winner was determined by ${TiebreakerMethod.RANDOM_SELECTION} due to a tie in the final match.`;
        this.finalTournament.winnerTieResolved = true;
      }
    } else {
      console.warn("No final round or matches were found. Tie resolution check skipped.");
    }
  }

    console.log("Final Tournament Result:", this.finalTournament);
  }
  

  async simulateSingleElimination(tournament: Tournament): Promise<void> {
    for (const [roundIndex, round] of this.bracket.entries()) {
      round.createdAt = new Date();
      round.startTime = new Date();
      round.status = 'ongoing';
  
      for (const match of round.matches) {
        await this.simulateMatch(match, round.stage);
      }
  
      round.endTime = new Date();
      round.duration = round.endTime.getTime() - round.startTime.getTime();
      round.status = 'completed';
  
      if (roundIndex < this.bracket.length - 1) {
        this.propagateWinnersToNextRound(roundIndex);
      }
  
      tournament.rounds.push(round);
    }
  
    // Finalize tournament winner
    const finalRound = this.bracket[this.bracket.length - 1];
    tournament.finalWinner = finalRound.matches[0].winner;
    tournament.finalWinnerType = finalRound.matches[0].winnerType;
  }

  async simulateRoundRobin(tournament: Tournament): Promise<void> {
    const round: Round = {
      roundNumber: 1,
      matches: this.roundRobinMatches,
      stage: Stage.ROUND_ROBIN_STAGE,
      createdAt: new Date(),
      startTime: new Date(),
      endTime: null,
      duration: null,
      status: 'ongoing',
    };
  
    // Initialize win and point trackers
    const winCounts = new Map<string, number>();
    const pointsScored = new Map<string, number>();
  
    // Run all matches and track wins and points
    for (const match of this.roundRobinMatches) {
      await this.simulateMatch(match, round.stage);
  
      if (match.player1 && match.player2) {
        // Update points for both players
        pointsScored.set(match.player1, (pointsScored.get(match.player1) || 0) + (match.player1Score || 0));
        pointsScored.set(match.player2, (pointsScored.get(match.player2) || 0) + (match.player2Score || 0));
  
        // Update win counts based on match outcome
        if (match.winner) {
          winCounts.set(match.winner, (winCounts.get(match.winner) || 0) + 1);
        }
      }
    }
  
    // End the round
    round.endTime = new Date();
    round.duration = round.endTime.getTime() - round.startTime.getTime();
    round.status = 'completed';
    tournament.rounds.push(round);
  
    // Find the players with the most wins
    const maxWins = Math.max(...Array.from(winCounts.values()));
    const topPlayers = Array.from(winCounts.entries())
      .filter(([_, wins]) => wins === maxWins)
      .map(([name]) => name);
  
    // Determine the winner based on tiebreakers
    if (topPlayers.length === 1) {
      // Clear win determination based on most wins
      tournament.finalWinner = topPlayers[0];
      const winnerWins = winCounts.get(topPlayers[0]) || 0;
      tournament.winnerDeterminationMethodMessage = `Most Wins: ${topPlayers[0]} won the most games with ${winnerWins} wins.`;
      tournament.winnerTieResolved = false;
      tournament.tiebreakerMethod = TiebreakerMethod.MOST_WINS;
    } else {
      // Resolve ties by total points scored
      const topScorer = topPlayers.reduce((highest, player) => {
        const playerPoints = pointsScored.get(player) || 0;
        const highestPoints = pointsScored.get(highest) || 0;
        return playerPoints > highestPoints ? player : highest;
      });
  
      // Find players with the same highest points in case of a tie in points as well
      const tiedTopScorers = topPlayers.filter(player => (pointsScored.get(player) || 0) === (pointsScored.get(topScorer) || 0));
  
      if (tiedTopScorers.length === 1) {
        // If only one top scorer by points, they are the winner
        tournament.finalWinner = tiedTopScorers[0];
        const winnerPoints = pointsScored.get(tiedTopScorers[0]) || 0;
        tournament.winnerDeterminationMethodMessage = `Most Points: ${tiedTopScorers[0]} won based on scoring the highest total points (${winnerPoints}) among tied players with the most wins.`;
        tournament.winnerTieResolved = true;
        tournament.tiebreakerMethod = TiebreakerMethod.TOTAL_POINTS;
      } else {
        // Final random selection if there is still a tie
        tournament.finalWinner = tiedTopScorers[Math.floor(Math.random() * tiedTopScorers.length)];
        const finalWinnerWins = winCounts.get(tournament.finalWinner) || 0;
        const finalWinnerPoints = pointsScored.get(tournament.finalWinner) || 0;
        tournament.winnerDeterminationMethodMessage = `Random Selection: ${tournament.finalWinner} was randomly chosen among players with the highest wins (${finalWinnerWins}) and points (${finalWinnerPoints}) due to a complete tie.`;
        tournament.winnerTieResolved = true;
        tournament.tiebreakerMethod = TiebreakerMethod.RANDOM_SELECTION;
      }
    }
  
    tournament.finalWinnerType = this.slots.find(slot => slot.name === tournament.finalWinner)?.isBot ? 'Bot' : 'Player';
  }

  resolveTie(match: Match): void {
    // Randomly choose a winner
    const winnerRandomlyChosen = Math.random() < 0.5;
    if (winnerRandomlyChosen) {
      match.winner = match.player1;
      match.winnerType = match.player1Type;
    } else {
      match.winner = match.player2;
      match.winnerType = match.player2Type;
    }
    match.outcome = MatchOutcome.FINISHED;
    match.tieResolved = true;
  
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
    if (index === 0) {
      // Prevent changes to player 1 to ensure they remain the host
      slot.isBot = false;
      slot.name = this.hostname;
    } else {
      // Allow changes for other slots
      slot.name = slot.isBot ? `Bot ${index + 1}` : ''; // Set default for bots or empty for manual entry
    }
  }
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && this.gameRunning) {
      this.togglePause();
    }
  }
  togglePause(): void {
    if (this.currentGameComponentRef) {
      if (this.isPaused) {
        // Resume the game
        (this.currentGameComponentRef.instance as any).resume();
      } else {
        // Pause the game
        (this.currentGameComponentRef.instance as any).pause();
      }
      // Toggle the paused state
      this.isPaused = !this.isPaused;
    }
  }
}