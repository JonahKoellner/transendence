import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TournamentLobbyService } from 'src/app/services/tournament-lobby.service';

@Component({
  selector: 'app-join-room',
  templateUrl: './join-room.component.html',
  styleUrls: ['./join-room.component.scss']
})
export class JoinRoomComponent {
  roomId: string = '';
  joined = false;

  constructor(private http: HttpClient, private lobbyService: TournamentLobbyService,private router: Router) {}

  joinRoom() {
    this.lobbyService.joinRoom(this.roomId).subscribe(() => {
      this.joined = true;
      this.router.navigate([`/games/online-tournament/game-room/${this.roomId}`]); 
    });
  }
}
