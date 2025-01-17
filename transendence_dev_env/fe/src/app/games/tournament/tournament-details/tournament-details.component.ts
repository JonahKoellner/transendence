import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameService } from '../../game.service';
import { Tournament } from '../local/start/start.component';

@Component({
  selector: 'app-tournament-details',
  templateUrl: './tournament-details.component.html',
  styleUrls: ['./tournament-details.component.scss']
})
export class TournamentDetailsComponent {
  tournament: Tournament | null = null;
  errorMessage: string = '';
  playerLeftMap: string[] = [];
  playersLeaveInfo: { [playerName: string]: { round: number; matchIndex: number } } = {};
  playersLeaveInfoKeys: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private gameService: GameService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.fetchTournament(Number(params.get('id')));
    });
  }

  checkIfPlayerLeft(players: string[] | undefined, player: string, playertype: string): boolean {
    if (players === undefined) {
      return false;
    }
    if (playertype === 'Bot' && players?.indexOf(player) != -1) {
      return true;
    }
    return false;
  }

  checkIfPlayerLeftFirstTime(players: string[] | undefined, player: string, playertype: string): boolean {
    if (players === undefined) {
      return false;
    }
    if (playertype === 'Bot' && players?.indexOf(player) != -1 && this.playerLeftMap.indexOf(player) === -1) {
      this.playerLeftMap.push(player);
      return true;
    }
    return false;
  }

  fetchTournament(tournamentId: number): void {
    this.gameService.getTournamentById(tournamentId).subscribe({
      next: (tournament) => {this.tournament = tournament; this.processPlayerLeaveInfo();},
      error: (error) => this.errorMessage = 'Failed to load tournament details'
    });
  }
  processPlayerLeaveInfo(): void {
    if (!this.tournament) return;

    const playerTypes: { [playerName: string]: 'Player' | 'Bot' } = {};

    // Initialize playerTypes with initial player types
    const allParticipants = this.tournament.all_participants || [];
    const playersOnly = this.tournament.players_only || [];

    for (const participant of allParticipants) {
      if (playersOnly.includes(participant)) {
        playerTypes[participant] = 'Player';
      } else {
        playerTypes[participant] = 'Bot';
      }
    }

    // Process rounds in order
    for (const round of this.tournament.rounds) {
      for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex++) {
        const match = round.matches[matchIndex];

        const players = [
          { name: match.player1, type: match.player1_type },
          { name: match.player2, type: match.player2_type }
        ];

        for (const player of players) {
          const prevType = playerTypes[player.name];

          if (prevType && prevType === 'Player' && player.type === 'Bot') {
            // Player has changed from 'Player' to 'Bot', so they left
            if (!this.playersLeaveInfo[player.name]) {
              this.playersLeaveInfo[player.name] = {
                round: round.round_number,
                matchIndex: matchIndex
              };
            }
          }
          // Update the player's type for the next iteration
          playerTypes[player.name] = player.type;
        }
      }
    }

    // After processing, set the keys
    this.playersLeaveInfoKeys = Object.keys(this.playersLeaveInfo);
  }

  hasPlayerLeft(playerName: string, roundNumber: number): boolean {
    const leaveInfo = this.playersLeaveInfo[playerName];
    return leaveInfo !== undefined && roundNumber > leaveInfo.round;
  }

  hasPlayerJustLeft(playerName: string, roundNumber: number, matchIndex: number): boolean {
    const leaveInfo = this.playersLeaveInfo[playerName];
    return (
      leaveInfo !== undefined &&
      leaveInfo.round === roundNumber &&
      leaveInfo.matchIndex === matchIndex
    );
  }
}