import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { GameLobbyArenaService } from 'src/app/services/game-lobby-arena.service';

@Component({
  selector: 'app-game-rooms-arena',
  templateUrl: './game-rooms.component.html',
  styleUrls: ['./game-rooms.component.scss']
})
export class GameRoomsArenaComponent {
  rooms: any[] = [];

  constructor(private lobbyService: GameLobbyArenaService,private toastr: ToastrService) {}

  ngOnInit() {
    this.fetchRooms();
  }

  fetchRooms() {
    this.lobbyService.getAllRooms().subscribe(
      (rooms) => {
        this.rooms = rooms;
      },
      (error) => this.toastr.error('Error fetching rooms', 'Error')
    );
  }
}
