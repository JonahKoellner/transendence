import { Component } from '@angular/core';
import { GameService } from '../../game.service';
import { Tournament } from '../local/start/start.component';

@Component({
  selector: 'app-tournament-list',
  templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss']
})
export class TournamentListComponent {
  tournaments: Tournament[] = [];
  filteredTournaments: Tournament[] = [];
  errorMessage: string = '';
    // Filters and Sorting Options
    searchName: string = '';
    searchParticipant: string = '';
    startDate: string = '';
    endDate: string = '';
    sortOrder: 'asc' | 'desc' = 'desc';
  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    this.fetchTournaments();
  }

  fetchTournaments(): void {
    this.gameService.getTournaments().subscribe({
      next: (tournaments) => {this.tournaments = tournaments; this.applyFilters();},
      error: (error) => this.errorMessage = 'Failed to load tournaments'
    });
  }

  applyFilters(): void {
    this.filteredTournaments = this.tournaments
        .filter((tournament) => {
            const matchesName = tournament.name.toLowerCase().includes(this.searchName.toLowerCase());
            const matchesParticipant = tournament.all_participants?.some(participant =>
                participant.toLowerCase().includes(this.searchParticipant.toLowerCase())
            );

            const tournamentDate = new Date(tournament.start_time).getTime();
            const matchesStartDate = this.startDate ? tournamentDate >= new Date(this.startDate).getTime() : true;
            const matchesEndDate = this.endDate ? tournamentDate <= new Date(this.endDate).getTime() : true;

            return matchesName && matchesParticipant && matchesStartDate && matchesEndDate;
        })
        .sort((a, b) => {
            const dateA = new Date(a.start_time).getTime();
            const dateB = new Date(b.start_time).getTime();
            return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
}
}
