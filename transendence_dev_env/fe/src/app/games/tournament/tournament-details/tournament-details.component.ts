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
  playersLeaveRound: { [playerName: string]: number } = {};
  playersLeaveRoundKeys: string[] = [];

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
    // console.log(player, playertype, players);
    if (players === undefined) {
      console.log("Undefined players");
      return false;
    }
    if (playertype === 'Bot' && players?.indexOf(player) != -1) {
      // console.log("Bot player found");
      return true;
    }
    return false;
  }

  checkIfPlayerLeftFirstTime(players: string[] | undefined, player: string, playertype: string): boolean {
    // console.log(player, playertype, players);
    if (players === undefined) {
      console.log("Undefined players");
      return false;
    }
    if (playertype === 'Bot' && players?.indexOf(player) != -1 && this.playerLeftMap.indexOf(player) === -1) {
      this.playerLeftMap.push(player);
      console.log("Player left first time", this.playerLeftMap);
      return true;
    }
    console.log("Player left not first time", player);
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

    // Process rounds in order
    for (const round of this.tournament.rounds) {
      for (const match of round.matches) {
        const players = [
          { name: match.player1, type: match.player1_type },
          { name: match.player2, type: match.player2_type },
        ];

        for (const player of players) {
          const prevType = playerTypes[player.name];
          if (prevType && prevType === 'Player' && player.type === 'Bot') {
            // Player has changed from 'Player' to 'Bot', so they left
            if (!this.playersLeaveRound[player.name]) {
              this.playersLeaveRound[player.name] = round.round_number;
            }
          }
          // Update the player's type
          playerTypes[player.name] = player.type;
        }
      }
    }

    // After processing, set the keys
    this.playersLeaveRoundKeys = Object.keys(this.playersLeaveRound);
  }

  hasPlayerLeft(playerName: string, roundNumber: number): boolean {
    const leftRound = this.playersLeaveRound[playerName];
    return leftRound !== undefined && roundNumber >= leftRound;
  }

}
