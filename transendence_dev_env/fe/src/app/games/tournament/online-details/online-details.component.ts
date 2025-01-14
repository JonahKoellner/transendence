import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TournamentService } from 'src/app/services/tournament.service';
import { OnlineTournament } from '../online/online.component';  // Adjust import path as needed

@Component({
  selector: 'app-online-details',
  templateUrl: './online-details.component.html',
  styleUrls: ['./online-details.component.scss']
})
export class OnlineDetailsComponent implements OnInit {
  onlineTournament: OnlineTournament | null = null;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private tournamentService: TournamentService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const idParam = params.get('id');
      if (idParam) {
        const tournamentId = Number(idParam);
        this.fetchTournament(tournamentId);
      }
    });
  }

  fetchTournament(tournamentId: number): void {
    this.tournamentService.getTournamentById(tournamentId).subscribe({
      next: (tournament) => {
        this.onlineTournament = tournament;
      },
      error: () => this.errorMessage = 'Failed to load tournament details'
    });
  }
}
