import { Component, OnInit } from '@angular/core';
import { Game, GameService } from '../game.service';

@Component({
  selector: 'app-games-list',
  templateUrl: './games-list.component.html',
  styleUrls: ['./games-list.component.scss']
})
export class GamesListComponent implements OnInit {
  games: Game[] = [];
  filteredGames: Game[] = [];
  errorMessage: string = '';

  // Filters and Sorting Options
  searchPlayer: string = '';
  startDate: string = '';
  endDate: string = '';
  sortOrder: 'asc' | 'desc' = 'desc';

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    this.fetchGames();
  }

  fetchGames(): void {
    this.gameService.getAllGames().subscribe({
      next: (games) => {
        this.games = games;
        this.applyFilters();
      },
      error: () => (this.errorMessage = 'Failed to load games')
    });
  }

  applyFilters(): void {
    this.filteredGames = this.games
      .filter((game) => {
        const players = [
          game.player1?.username,
          game.player2?.username,
          game.player3?.username,
          game.player4?.username
        ].filter(Boolean);

        const matchesPlayer = players.some((playerName) =>
          playerName?.toLowerCase().includes(this.searchPlayer.toLowerCase())
        );

        const gameDate = new Date(game.start_time).getTime();
        const matchesStartDate = this.startDate
          ? gameDate >= new Date(this.startDate).getTime()
          : true;
        const matchesEndDate = this.endDate
          ? gameDate <= new Date(this.endDate).getTime()
          : true;

        return matchesPlayer && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        const dateA = new Date(a.start_time).getTime();
        const dateB = new Date(b.start_time).getTime();
        return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
  }
}