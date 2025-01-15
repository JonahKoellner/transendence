import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TournamentLobbyService } from 'src/app/services/tournament-lobby.service';

@Component({
  selector: 'app-create-room',
  templateUrl: './create-room.component.html',
  styleUrls: ['./create-room.component.scss']
})
export class CreateRoomComponent implements OnInit {
  roomId: string | null = null;

  constructor(
    private http: HttpClient,
    private lobbyService: TournamentLobbyService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.createRoom();
    }, 1000);
  }

  createRoom(): void {
    this.lobbyService.createRoom().subscribe({
      next: (response) => {
        this.roomId = response.room_id;
        // Navigate to newly created room
        this.router.navigate([`/games/online-tournament/game-room/${this.roomId}`]);
      },
      error: (err) => {
        this.toastr.error('Failed to create room. Please try again later.');
        console.error(err);
      },
    });
  }
}
