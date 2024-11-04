import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameLobbyService } from 'src/app/services/game-lobby.service';

@Component({
  selector: 'app-join-room',
  templateUrl: './join-room.component.html',
  styleUrls: ['./join-room.component.scss']
})
export class JoinRoomComponent {
  roomId: string = '';
  joined = false;

  constructor(private http: HttpClient, private lobbyService: GameLobbyService,private router: Router) {}

  joinRoom() {
    this.lobbyService.joinRoom(this.roomId).subscribe(() => {
      this.joined = true;
      this.router.navigate([`/games/online-pvp/game-room/${this.roomId}`]); 
    });
  }
}
