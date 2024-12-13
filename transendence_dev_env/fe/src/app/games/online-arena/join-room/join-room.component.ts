import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameLobbyArenaService } from 'src/app/services/game-lobby-arena.service';

@Component({
  selector: 'app-join-room-arena',
  templateUrl: './join-room.component.html',
  styleUrls: ['./join-room.component.scss']
})
export class JoinRoomArenaComponent {
  roomId: string = '';
  joined = false;

  constructor(private http: HttpClient, private lobbyService: GameLobbyArenaService,private router: Router) {}

  joinRoom() {
    this.lobbyService.joinRoom(this.roomId).subscribe(() => {
      this.joined = true;
      this.router.navigate([`/games/online-arena/game-room/${this.roomId}`]); 
    });
  }
}
