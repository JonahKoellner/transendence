import { Component } from '@angular/core';
import { GameLobbyArenaService } from 'src/app/services/game-lobby-arena.service';

@Component({
  selector: 'app-game-rooms-arena',
  templateUrl: './game-rooms.component.html',
  styleUrls: ['./game-rooms.component.scss']
})
export class GameRoomsArenaComponent {
  rooms: any[] = [];

  constructor(private lobbyService: GameLobbyArenaService) {}

  ngOnInit() {
    this.fetchRooms();
  }

  fetchRooms() {
    this.lobbyService.getAllRooms().subscribe(
      (rooms) => {
        this.rooms = rooms;
      },
      (error) => console.error('Error fetching rooms:', error)
    );
  }
}
