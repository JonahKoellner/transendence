import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameLobbyService } from 'src/app/services/game-lobby.service';

export interface GameSettings {
  maxRounds: number;
  roundScoreLimit: number;
}
@Component({
  selector: 'app-create-room',
  templateUrl: './create-room.component.html',
  styleUrls: ['./create-room.component.scss']
})
export class CreateRoomComponent {
  roomId: string | null = null;
  settings: GameSettings = {
    maxRounds: 3,
    roundScoreLimit: 3
  };
  constructor(private http: HttpClient, private lobbyService: GameLobbyService, private router: Router) {}

  createRoom() {
    this.lobbyService.createRoom(this.settings).subscribe(response => {
      this.roomId = response.room_id;
      this.router.navigate([`/games/online-pvp/game-room/${this.roomId}`]); 
    });
  }
}
