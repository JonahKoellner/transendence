import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { TournamentLobbyService } from 'src/app/services/tournament-lobby.service';

@Component({
  selector: 'app-game-rooms-arena',
  templateUrl: './game-rooms.component.html',
  styleUrls: ['./game-rooms.component.scss']
})
export class GameRoomsComponent {
  rooms: any[] = [];
  pGames: number = 1; // Current page
  itemsPerPageGames: number = 25; // Items per page
  constructor(private lobbyService: TournamentLobbyService,private toastr: ToastrService) {}

  ngOnInit() {
    this.fetchRooms();
  }
  onPageChangeGames(page: number) {
    this.pGames = page;
  }
  fetchRooms() {
    this.lobbyService.getAllRooms().subscribe(
      (rooms) => {
        this.rooms = rooms;
      },
      (error) => this.toastr.error('Error fetching rooms', 'Error')
    );
  }
}
