import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TournamentLobbyService } from 'src/app/services/tournament-lobby.service';

@Component({
  selector: 'app-create-room',
  templateUrl: './create-room.component.html',
  styleUrls: ['./create-room.component.scss']
})
export class CreateRoomComponent {
  roomId: string | null = null;
  constructor(private http: HttpClient, private lobbyService: TournamentLobbyService, private router: Router, private toastr: ToastrService) {}

  createRoom() {
    this.lobbyService.createRoom().subscribe(response => {
      this.roomId = response.room_id;
      this.router.navigate([`/games/online-tournament/game-room/${this.roomId}`]);
    });
  }
}