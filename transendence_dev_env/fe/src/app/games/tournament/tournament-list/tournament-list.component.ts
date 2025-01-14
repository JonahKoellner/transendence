import { Component, OnInit } from '@angular/core';
import { GameService } from '../../game.service';
import { Tournament } from '../local/start/start.component';
import { TournamentService } from 'src/app/services/tournament.service';
import { OnlineTournament } from '../online/online.component';

interface CombinedTournament {
  id: string | number;
  name: string;
  type: string;
  participants: string[];
  startTime: Date;
  status: string;
  finalWinner?: string | null;
  isOnline: boolean;
}
@Component({
  selector: 'app-tournament-list',
  templateUrl: './tournament-list.component.html',
  styleUrls: ['./tournament-list.component.scss']
})
export class TournamentListComponent implements OnInit {
  // Original arrays
  tournaments: Tournament[] = [];
  onlineTournaments: OnlineTournament[] = [];

  // A combined array for both offline and online
  allTournaments: CombinedTournament[] = [];
  filteredTournaments: CombinedTournament[] = [];

  // Error Handling
  errorMessage: string = '';

  // Filters and Sorting
  searchName: string = '';
  searchParticipant: string = '';
  startDate: string = '';
  endDate: string = '';
  sortOrder: 'asc' | 'desc' = 'desc';

  // An optional filter to show only offline or online
  // Possible values: 'all', 'offline', 'online'
  filterTournamentType: 'all' | 'offline' | 'online' = 'all';

  // Pagination
  pTournaments: number = 1;
  itemsPerPageTournaments: number = 6;

  constructor(
    private gameService: GameService,
    private tournamentService: TournamentService
  ) {}

  ngOnInit(): void {
    // Fetch both offline and online tournaments
    this.fetchTournaments();
    this.fetchOnlineTournaments();
  }

  onPageChangeTournaments(page: number) {
    this.pTournaments = page;
  }

  fetchTournaments(): void {
    this.gameService.getTournaments().subscribe({
      next: (tournaments) => {
        this.tournaments = tournaments;
        // Once we have the offline tournaments, merge them
        this.mergeAllTournaments();
      },
      error: () => (this.errorMessage = 'Failed to load offline tournaments')
    });
  }

  fetchOnlineTournaments(): void {
    this.tournamentService.getTournaments().subscribe({
      next: (onlineTournaments) => {
        this.onlineTournaments = onlineTournaments;
        // Once we have the online tournaments, merge them
        this.mergeAllTournaments();
      },
      error: () => (this.errorMessage = 'Failed to load online tournaments')
    });
  }

  /**
   * Merge offline tournaments & online tournaments into a single array
   * then apply filters.
   */
  mergeAllTournaments(): void {
    // Map offline tournaments to CombinedTournament
    const offlineMapped: CombinedTournament[] = this.tournaments.map((t) => ({
      id: t.id ?? 0,
      name: t.name,
      type: t.type, // or t.type.toString() if needed
      participants: t.all_participants || [],
      startTime: new Date(t.start_time),
      status: t.status,
      finalWinner: t.final_winner,
      isOnline: false,
    }));

    // Map online tournaments to CombinedTournament
    const onlineMapped: CombinedTournament[] = this.onlineTournaments.map((ot) => ({
      // For online tournaments, use roomId as 'id' or anything unique
      id: ot.roomId,
      name: ot.name,
      type: ot.type,
      participants: ot.participants?.map((user) => user.username) || [],
      startTime: new Date(ot.startTime),
      status: ot.status,
      finalWinner: ot.finalWinner,
      isOnline: true,
    }));

    // Combine them
    this.allTournaments = [...offlineMapped, ...onlineMapped];

    // Now apply filters + sorting to get filteredTournaments
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredTournaments = this.allTournaments
      .filter((tournament) => {
        // Filter by name
        const matchesName = tournament.name
          .toLowerCase()
          .includes(this.searchName.toLowerCase());

        // Filter by participant
        const matchesParticipant = tournament.participants.some((participant) =>
          participant.toLowerCase().includes(this.searchParticipant.toLowerCase())
        );

        // Filter by start/end date
        const tournamentTime = tournament.startTime.getTime();
        const matchesStartDate = this.startDate
          ? tournamentTime >= new Date(this.startDate).getTime()
          : true;
        const matchesEndDate = this.endDate
          ? tournamentTime <= new Date(this.endDate).getTime()
          : true;

        // Filter by online/offline if user wants to see only one type
        const matchesType =
          this.filterTournamentType === 'all' ||
          (this.filterTournamentType === 'online' && tournament.isOnline) ||
          (this.filterTournamentType === 'offline' && !tournament.isOnline);

        return (
          matchesName &&
          matchesParticipant &&
          matchesStartDate &&
          matchesEndDate &&
          matchesType
        );
      })
      .sort((a, b) => {
        // Sort by startTime ascending or descending
        const dateA = a.startTime.getTime();
        const dateB = b.startTime.getTime();
        return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
  }
}