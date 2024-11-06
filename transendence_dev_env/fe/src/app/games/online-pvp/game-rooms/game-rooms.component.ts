import { Component } from '@angular/core';
import { GameLobbyService } from 'src/app/services/game-lobby.service';

@Component({
  selector: 'app-game-rooms',
  templateUrl: './game-rooms.component.html',
  styleUrls: ['./game-rooms.component.scss']
})
export class GameRoomsComponent {
  rooms: any[] = [];

  constructor(private lobbyService: GameLobbyService) {}

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
