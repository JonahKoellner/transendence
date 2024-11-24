import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameLobbyChaosService } from 'src/app/services/game-lobby-chaos.service';

@Component({
  selector: 'app-join-room-chaos-chaos',
  templateUrl: './join-room-chaos.component.html',
  styleUrls: ['./join-room-chaos.component.scss']
})
export class JoinRoomChaosComponent {
  roomId: string = '';
  joined = false;

  constructor(private http: HttpClient, private lobbyService: GameLobbyChaosService,private router: Router) {}

  joinRoom() {
    this.lobbyService.joinRoom(this.roomId).subscribe(() => {
      this.joined = true;
      this.router.navigate([`/games/online-pvp-chaos/game-room/${this.roomId}`]); 
    });
  }
}
