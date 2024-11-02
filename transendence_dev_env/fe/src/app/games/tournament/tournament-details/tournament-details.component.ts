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

  constructor(
    private route: ActivatedRoute,
    private gameService: GameService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.fetchTournament(Number(params.get('id')));
    });
  }

  fetchTournament(tournamentId: number): void {
    this.gameService.getTournamentById(tournamentId).subscribe({
      next: (tournament) => this.tournament = tournament,
      error: (error) => this.errorMessage = 'Failed to load tournament details'
    });
  }
}
