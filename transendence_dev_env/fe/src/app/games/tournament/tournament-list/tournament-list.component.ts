import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { GameService } from '../../game.service';
import { Tournament } from '../local/start/start.component';
import { TournamentService } from 'src/app/services/tournament.service';
import { OnlineTournament } from '../online/online.component';

@Component({
  selector: 'app-tournament-list',
  templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss'],
})
export class TournamentListComponent implements OnInit {
  // Offline
  tournaments: Tournament[] = [];
  filteredOfflineTournaments: Tournament[] = [];

  // Online
  onlineTournaments: OnlineTournament[] = [];
  filteredOnlineTournaments: OnlineTournament[] = [];

  // Error Handling
  errorMessage: string = '';

  // Filters and Sorting
  searchName: string = '';
  searchParticipant: string = '';
  startDate: string = '';
  endDate: string = '';
  sortOrder: 'asc' | 'desc' = 'desc';
  showFilters: boolean = false;

  // Possible values: 'all', 'offline', 'online'
  filterTournamentType: 'all' | 'offline' | 'online' = 'all';

  // Pagination
  pTournaments: number = 1;         // You can use different pagination variables if you wish
  itemsPerPageTournaments: number = 6;

  // Loading flag
  isLoading: boolean = false;

  constructor(
    private gameService: GameService,
    private tournamentService: TournamentService
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.fetchTournaments();
  }

  onPageChangeTournaments(page: number) {
    this.pTournaments = page;
  }

  /**
   * Fetch offline and online tournaments separately (no merging).
   */
  private fetchTournaments(): void {
    forkJoin([
      this.gameService.getTournaments(),       // Offline
      this.tournamentService.getTournaments()  // Online
    ]).subscribe({
      next: ([offlineTournaments, onlineTournaments]) => {
        // Store raw data
        this.tournaments = offlineTournaments || [];
        this.onlineTournaments = onlineTournaments || [];

        // Apply filters
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        // console.error('Failed to load tournaments:', error);
        this.errorMessage = 'Failed to load tournaments.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Filter (and sort) each list separately.
   */
  applyFilters(): void {
    // 1) Filter offline tournaments
    this.filteredOfflineTournaments = this.tournaments
      .filter((tournament) => {
        // By name
        const matchesName = tournament.name
          .toLowerCase()
          .includes(this.searchName.toLowerCase());

        // By participant
        const matchesParticipant = tournament.all_participants?.some((participant) =>
          participant.toLowerCase().includes(this.searchParticipant.toLowerCase())
        );

        // By start/end date
        const tournamentTime = new Date(tournament.start_time).getTime();
        const matchesStartDate = this.startDate
          ? tournamentTime >= new Date(this.startDate).getTime()
          : true;
        const matchesEndDate = this.endDate
          ? tournamentTime <= new Date(this.endDate).getTime()
          : true;

        return matchesName && matchesParticipant && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        const dateA = new Date(a.start_time).getTime();
        const dateB = new Date(b.start_time).getTime();
        return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });

    // 2) Filter online tournaments
    this.filteredOnlineTournaments = this.onlineTournaments
      .filter((tournament) => {
        // By name
        const matchesName = tournament.name
          .toLowerCase()
          .includes(this.searchName.toLowerCase());

        // By participant (each tournament has an array of User objects or something similar)
        const matchesParticipant = tournament.participants?.some((user) =>
          user.username.toLowerCase().includes(this.searchParticipant.toLowerCase())
        );

        // By start/end date
        const tournamentTime = new Date(tournament.created_at).getTime();
        const matchesStartDate = this.startDate
          ? tournamentTime >= new Date(this.startDate).getTime()
          : true;
        const matchesEndDate = this.endDate
          ? tournamentTime <= new Date(this.endDate).getTime()
          : true;

        return matchesName && matchesParticipant && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
  }
}
