
import { Component, ComponentFactoryResolver, ComponentRef, HostListener, OnInit, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { PveGameCanvasComponent } from '../pve-game-canvas/pve-game-canvas.component';
import { PvpGameCanvasComponent } from '../pvp-game-canvas/pvp-game-canvas.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProfileService, UserProfile } from 'src/app/profile.service';
import { GameService } from 'src/app/games/game.service';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

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
  player1_type: 'Player' | 'Bot';
  player2: string;
  player2_type: 'Player' | 'Bot';
  winner: string | null;
  winner_type: 'Player' | 'Bot' | null;
  outcome: MatchOutcome | null;
  player1_score?: number;
  player2_score?: number;
  tie_resolved?: boolean;
  created_at: Date;
  start_time: Date;
  end_time: Date | null;
  duration: number | null;
  status: 'pending' | 'ongoing' | 'completed' | 'failed';
}

interface Round {
  round_number: number;
  matches: Match[];
  stage: Stage;
  created_at: Date;
  start_time: Date;
  end_time: Date | null;
  duration: number | null;
  status: 'pending' | 'ongoing' | 'completed';
}

export interface Tournament {
  id: number | null;
  name: string;
  type: TournamentType;
  rounds: Round[];
  final_winner: string | null;
  final_winner_type: 'Player' | 'Bot' | null;
  all_participants?: string[];
  players_only?: string[];
  created_at: Date;
  start_time: Date;
  end_time: Date | null;
  duration: number | null;
  status: 'pending' | 'ongoing' | 'completed';
  winner_determination_method_message?: string;
  tiebreaker_method?: TiebreakerMethod;
  winner_tie_resolved?: boolean;
  host: number
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
  replacePlayer1: boolean = false;
  replacePlayer2: boolean = false;
  createdTournamentFromServer: Tournament | null = null;
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
  gameCancelled = false;
  hostname: string = '';
  host: UserProfile | null = null;
  private isComponentActive = true;
  leavingPlayer1 = false;
  leavingPlayer2 = false;
  private holdTimeout: any;
  constructor(private modalService: NgbModal, private resolver: ComponentFactoryResolver, private profileService: ProfileService, private gameService: GameService, private toastr: ToastrService) { }

  ngOnInit(): void {
    this.profileService.getProfile().subscribe(
      profile => {
        this.hostname = profile.display_name || profile.username;
        this.host = profile;
      },
      error => {
        this.toastr.error('Failed to load user profile.', 'Error');
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
        player1_type: this.slots[i].isBot ? 'Bot' : 'Player',
        player2: this.slots[i + 1]?.name || '',
        player2_type: this.slots[i + 1]?.isBot ? 'Bot' : 'Player',
        winner: null,
        winner_type: null,
        outcome: null,
        created_at: new Date(),
        start_time: new Date(),
        end_time: null,
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
      round_number: 1,
      matches: firstRoundMatches,
      stage: startingStage,
      created_at: new Date(),
      start_time: new Date(),
      end_time: null,
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
          player1_type: 'Player',
          player2: '',
          player2_type: 'Player',
          winner: null,
          winner_type: null,
          outcome: null,
          created_at: new Date(),
          start_time: new Date(),
          end_time: null,
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
        round_number: round + 1,
        matches: roundMatches,
        stage: stage,
        created_at: new Date(),
        start_time: new Date(),
        end_time: null,
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
        nextRound.matches[nextRoundMatchIndex].player1_type = match.winner_type!;
      } else {
        nextRound.matches[nextRoundMatchIndex].player2 = match.winner!;
        nextRound.matches[nextRoundMatchIndex].player2_type = match.winner_type!;
      }
    });
  }

  getLoserPlayer(matches: Match[], index: number): { name: string; type: 'Player' | 'Bot' } | null {
      const match = matches[index];
      if (!match || !match.winner) return null;
      return match.winner === match.player1
          ? { name: match.player2, type: match.player2_type }
          : { name: match.player1, type: match.player1_type };
  }

  buildRoundRobinMatches(): void {
    this.roundRobinMatches = [];
    for (let i = 0; i < this.maxPlayers; i++) {
      for (let j = i + 1; j < this.maxPlayers; j++) {
        this.roundRobinMatches.push({
          player1: this.slots[i].name,
          player1_type: this.slots[i].isBot ? 'Bot' : 'Player',
          player2: this.slots[j].name,
          player2_type: this.slots[j].isBot ? 'Bot' : 'Player',
          winner: null,
          winner_type: null,
          outcome: null,
          created_at: new Date(),
          start_time: new Date(), // Will be set when the match actually starts
          end_time: null,
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
        this.toastr.warning(`Player name "${name}" must be between 2 and 100 characters.`, 'Error');
        break;
      }
      if (uniqueNames.has(name)) {
        allNamesValid = false;
        this.toastr.warning(`Player name "${name}" is duplicated.`, 'Error');
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
      this.toastr.error('Please ensure all player names are unique and between 2 to 100 characters.', 'Error');
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
      final_winner: null,
      final_winner_type: null,
      created_at: new Date(),
      start_time: new Date(),
      end_time: null,
      duration: null,
      status: 'pending',
      id: null,
      host: this.host?.id || 0
    };

    // Reset match-level tie resolution flags and scores
    this.bracket?.forEach((round) => {
      round.matches.forEach((match) => {
        match.winner = null;
        match.winner_type = null;
        match.outcome = MatchOutcome.TIE;
        match.player1_score = 0;
        match.player2_score = 0;
        match.tie_resolved = false;
        match.status = 'pending';
        match.start_time = new Date();
        match.end_time = null;
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
    this.gameCancelled = false; // Reset the flag for each match
    match.created_at = new Date();
    match.status = 'ongoing';
    match.player1_score = 0;
    match.player2_score = 0;

    try {
      // Ensure player is on the left if it's a Player vs. Bot match
      if (match.player1_type === 'Bot' && match.player2_type === 'Player') {
        [match.player1, match.player2] = [match.player2, match.player1];
        [match.player1_type, match.player2_type] = [match.player2_type, match.player1_type];
        [match.player1_score, match.player2_score] = [match.player2_score, match.player1_score];
      }

      // Auto-simulate for Bot vs. Bot matches
      if (match.player1_type === 'Bot' && match.player2_type === 'Bot') {
        this.autoSimulateMatch(match);
      } else {
        // Show next match modal for any match with a player
        if (match.player1_type === 'Player' || match.player2_type === 'Player') {
          if (!this.isComponentActive) return;
          await this.showNextMatchModal();
          if (!this.isComponentActive) return;
        }

        // Incase of a player leaving we recheck to make the player 
        if (match.player1_type === 'Bot' && match.player2_type === 'Player') {
          [match.player1, match.player2] = [match.player2, match.player1];
          [match.player1_type, match.player2_type] = [match.player2_type, match.player1_type];
          [match.player1_score, match.player2_score] = [match.player2_score, match.player1_score];
        }

        match.start_time = new Date();

        // Load the appropriate game canvas
        if (match.player1_type === 'Player' && match.player2_type === 'Bot') {
          await this.loadPveGameCanvas(match, stage);
        } else if (match.player1_type === 'Player' && match.player2_type === 'Player') {
          await this.loadPvpGameCanvas(match, stage);
        }
        // Autosimulate of both players are bots after real ones have left
        if (match.player1_type === 'Bot' && match.player2_type === 'Bot') {
          this.autoSimulateMatch(match);
        }
      }

      // Finalize match details
      if (!this.gameCancelled) {
        match.end_time = new Date();
        match.duration = match.end_time.getTime() - match.start_time.getTime();
        match.status = 'completed';
      }
    } catch (error) {
      console.error("Error during match simulation:", error);
      this.toastr.error('Error during match simulation.', 'Error');
      match.status = 'failed';
    } finally {
      this.gameRunning = false;
      if (!this.gameCancelled && (match.player1_type === 'Player' || match.player2_type === 'Player')) {
        if (!this.isComponentActive) return;
        await this.showMatchResultModal();
      }
    }
  }

  // Warn user on navigation during an active game
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: Event): string | void {
    if (this.gameRunning) {
      event.preventDefault(); // Prevent the unload
      return (event as BeforeUnloadEvent).returnValue = ''; // Display the warning message
    }
  }
  // Cleanup on component destruction to handle active game state
  ngOnDestroy(): void {
    this.isComponentActive = false;
    if (this.gameRunning) {
      this.gameCancelled = true;
      this.gameRunning = false;
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
    match.player1_score = Math.floor(Math.random() * 10);
    match.player2_score = Math.floor(Math.random() * 10);
    if (match.player1_score > match.player2_score) {
      match.winner = match.player1;
      match.winner_type = match.player1_type;
      match.outcome = MatchOutcome.FINISHED;
    } else if (match.player2_score > match.player1_score) {
      match.winner = match.player2;
      match.winner_type = match.player2_type;
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
    if (match.player1_score === match.player2_score) {
      match.outcome = MatchOutcome.TIE;
      this.resolveTie(match);
    } else if (match.player1_score! > match.player2_score!) {
      match.winner = match.player1;
      match.winner_type = match.player1_type;
      match.outcome = MatchOutcome.FINISHED;
    } else {
      match.winner = match.player2;
      match.winner_type = match.player2_type;
      match.outcome = MatchOutcome.FINISHED;
    }
  
    componentRef.destroy();
    this.currentMatchDisplay = ''; // Clear display text after match
    resolve();
  }

  updateScore(match: Match, scorer: 'player1' | 'player2' | 'human' | 'bot'): void {
    if (scorer === 'player1' || scorer === 'human') {
      match.player1_score = (match.player1_score ?? 0) + 1;
    } else {
      match.player2_score = (match.player2_score ?? 0) + 1;
    }
  }

  async simulateTournament(): Promise<void> {
    try {
      // Step 1: Create initial tournament structure
      const tournament = await this.createTournament();
  
      // Step 2: Simulate tournament based on the selected type
      if (this.selectedTournamentType === TournamentType.SINGLE_ELIMINATION) {
        await this.simulateSingleElimination(tournament);
      } else if (this.selectedTournamentType === TournamentType.ROUND_ROBIN) {
        await this.simulateRoundRobin(tournament);
      }
  
      // Step 3: Finalize tournament details after all rounds
      this.finalizeTournamentDetails(tournament);
  
      // Step 4: Check and handle tie-breaking for the final match if necessary
      this.handleTieBreakingForFinal(tournament);
  
      // Step 5: Update tournament on the backend with final details
      await this.updateTournamentBackend(tournament);
      
      // console.log("Final Tournament Result:", this.finalTournament);
    } catch (error) {
      console.error("Error during tournament simulation:", error);
      this.toastr.error('Error during tournament simulation.', 'Error');
    }
  }
  
  private async createTournament(): Promise<Tournament> {
    const tournament: Tournament = {
      id: null,
      name: this.tournamentName,
      type: this.selectedTournamentType as TournamentType,
      rounds: [],
      final_winner: null,
      final_winner_type: null,
      created_at: new Date(),
      start_time: new Date(),
      end_time: null,
      duration: null,
      status: 'ongoing',
      host: this.host?.id || 0
    };
  
    // Wait for the tournament creation response
    const response = await firstValueFrom(this.gameService.createTournament(tournament));
    this.createdTournamentFromServer = response;
    return response;
  }
  
  private finalizeTournamentDetails(tournament: Tournament): void {
    // Ensure start_time is a Date object
    if (!(tournament.start_time instanceof Date)) {
      tournament.start_time = new Date(tournament.start_time);
    }
  
    // Set and verify end_time as Date
    tournament.end_time = new Date();
    if (!(tournament.end_time instanceof Date)) {
      tournament.end_time = new Date(tournament.end_time);
    }
  
    // Calculate duration using start and end times
    tournament.duration = tournament.end_time.getTime() - tournament.start_time.getTime();
    tournament.status = 'completed';
  
    // Collect participants and set them in finalTournament
    const all_participants = this.slots.map(slot => slot.name);
    const players_only = this.slots.filter(slot => !slot.isBot).map(slot => slot.name);
    
    this.finalTournament = {
      ...tournament,
      all_participants,
      players_only
    };
  }
  
  private handleTieBreakingForFinal(tournament: Tournament): void {
    const finalRound = this.bracket[this.bracket.length - 1];
    if (finalRound && finalRound.matches?.length > 0) {
      const finalMatch = finalRound.matches[0];
      
      if (finalMatch.tie_resolved && finalRound.stage === Stage.GRAND_FINALS) {
        this.finalTournament!.tiebreaker_method = TiebreakerMethod.RANDOM_SELECTION;
        this.finalTournament!.winner_determination_method_message = 
          `The tournament winner was determined by ${TiebreakerMethod.RANDOM_SELECTION} due to a tie in the final match.`;
        this.finalTournament!.winner_tie_resolved = true;
      }
    } else {
      console.warn("No final round or matches found. Tie resolution check skipped.");
    }
  }
  
  private async updateTournamentBackend(tournament: Tournament): Promise<void> {
    this.finalTournament!.id = this.createdTournamentFromServer?.id ?? null;
    await firstValueFrom(
      this.gameService.updateTournament(this.createdTournamentFromServer!.id!, this.finalTournament!)
    );
    // console.log("Tournament updated successfully:", this.finalTournament);
  }
  

  async simulateSingleElimination(tournament: Tournament): Promise<void> {
    for (const [roundIndex, round] of this.bracket.entries()) {
      round.created_at = new Date();
      round.start_time = new Date();
      round.status = 'ongoing';
  
      for (const match of round.matches) {
        await this.simulateMatch(match, round.stage);
      }
  
      round.end_time = new Date();
      round.duration = round.end_time.getTime() - round.start_time.getTime();
      round.status = 'completed';
  
      if (roundIndex < this.bracket.length - 1) {
        this.propagateWinnersToNextRound(roundIndex);
      }
  
      tournament.rounds.push(round);
    }
  
    // Finalize tournament winner
    const finalRound = this.bracket[this.bracket.length - 1];
    tournament.final_winner = finalRound.matches[0].winner;
    tournament.final_winner_type = finalRound.matches[0].winner_type;
  }

  async simulateRoundRobin(tournament: Tournament): Promise<void> {
    const round: Round = {
      round_number: 1,
      matches: this.roundRobinMatches,
      stage: Stage.ROUND_ROBIN_STAGE,
      created_at: new Date(),
      start_time: new Date(),
      end_time: null,
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
        pointsScored.set(match.player1, (pointsScored.get(match.player1) || 0) + (match.player1_score || 0));
        pointsScored.set(match.player2, (pointsScored.get(match.player2) || 0) + (match.player2_score || 0));
  
        // Update win counts based on match outcome
        if (match.winner) {
          winCounts.set(match.winner, (winCounts.get(match.winner) || 0) + 1);
        }
      }
    }
  
    // End the round
    round.end_time = new Date();
    round.duration = round.end_time.getTime() - round.start_time.getTime();
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
      tournament.final_winner = topPlayers[0];
      const winnerWins = winCounts.get(topPlayers[0]) || 0;
      tournament.winner_determination_method_message = `Most Wins: ${topPlayers[0]} won the most games with ${winnerWins} wins.`;
      tournament.winner_tie_resolved = false;
      tournament.tiebreaker_method = TiebreakerMethod.MOST_WINS;
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
        tournament.final_winner = tiedTopScorers[0];
        const winnerPoints = pointsScored.get(tiedTopScorers[0]) || 0;
        tournament.winner_determination_method_message = `Most Points: ${tiedTopScorers[0]} won based on scoring the highest total points (${winnerPoints}) among tied players with the most wins.`;
        tournament.winner_tie_resolved = true;
        tournament.tiebreaker_method = TiebreakerMethod.TOTAL_POINTS;
      } else {
        // Final random selection if there is still a tie
        tournament.final_winner = tiedTopScorers[Math.floor(Math.random() * tiedTopScorers.length)];
        const finalWinnerWins = winCounts.get(tournament.final_winner) || 0;
        const finalWinnerPoints = pointsScored.get(tournament.final_winner) || 0;
        tournament.winner_determination_method_message = `Random Selection: ${tournament.final_winner} was randomly chosen among players with the highest wins (${finalWinnerWins}) and points (${finalWinnerPoints}) due to a complete tie.`;
        tournament.winner_tie_resolved = true;
        tournament.tiebreaker_method = TiebreakerMethod.RANDOM_SELECTION;
      }
    }
  
    tournament.final_winner_type = this.slots.find(slot => slot.name === tournament.final_winner)?.isBot ? 'Bot' : 'Player';
  }

  resolveTie(match: Match): void {
    // Randomly choose a winner
    const winnerRandomlyChosen = Math.random() < 0.5;
    if (winnerRandomlyChosen) {
      match.winner = match.player1;
      match.winner_type = match.player1_type;
    } else {
      match.winner = match.player2;
      match.winner_type = match.player2_type;
    }
    match.outcome = MatchOutcome.FINISHED;
    match.tie_resolved = true;
  
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

  startHold(player: string) {
    this.cancelHold(player); // Ensure no existing timer is running
    this[player === 'player1' ? 'leavingPlayer1' : 'leavingPlayer2'] = true;
    
    // Start the hold timer (1.5 seconds)
    this.holdTimeout = setTimeout(() => this.triggerLeave(player), 1500);
  }

  cancelHold(player: string) {
    clearTimeout(this.holdTimeout);
    this.holdTimeout = null;
    this[player === 'player1' ? 'leavingPlayer1' : 'leavingPlayer2'] = false;
  }

  triggerLeave(player: string) {
    // Trigger leave action after hold completes
    if (player === 'player1') {
      this.slots[0]
      this.leavingPlayer1 = false;
      this.replacePlayer1 = true;
      if (this.match) {
        this.match.player1_type = 'Bot';
      }
      alert(`${this.match?.player1} has left the game`);

    } else if (player === 'player2') {
      this.leavingPlayer2 = false;
      this.replacePlayer2 = true;
      if (this.match) {
        this.match.player2_type = 'Bot';
      }
      alert(`${this.match?.player2} has left the game`);

    }
  }
}