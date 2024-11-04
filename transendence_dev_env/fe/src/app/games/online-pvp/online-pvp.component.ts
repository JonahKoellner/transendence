import { Component } from '@angular/core';
import { GameLobbyService } from 'src/app/services/game-lobby.service';

@Component({
  selector: 'app-online-pvp',
  templateUrl: './online-pvp.component.html',
  styleUrls: ['./online-pvp.component.scss']
})
export class OnlinePvpComponent {
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