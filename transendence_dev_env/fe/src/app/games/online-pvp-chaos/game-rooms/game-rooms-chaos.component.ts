import { Component } from '@angular/core';
import { GameLobbyChaosService } from 'src/app/services/game-lobby-chaos.service';

@Component({
  selector: 'app-game-rooms-chaos',
  templateUrl: './game-rooms-chaos.component.html',
  styleUrls: ['./game-rooms-chaos.component.scss']
})
export class GameRoomsChaosComponent {
  rooms: any[] = [];

  constructor(private lobbyService: GameLobbyChaosService) {}

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
