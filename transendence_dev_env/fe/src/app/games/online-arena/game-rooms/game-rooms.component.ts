import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { GameLobbyArenaService } from 'src/app/services/game-lobby-arena.service';

@Component({
  selector: 'app-game-rooms-arena',
  templateUrl: './game-rooms.component.html',
  styleUrls: ['./game-rooms.component.scss']
})
export class GameRoomsArenaComponent {
  rooms: any[] = [];
  pGames: number = 1; // Current page
  itemsPerPageGames: number = 25; // Items per page
  constructor(private lobbyService: GameLobbyArenaService,private toastr: ToastrService) {}

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
