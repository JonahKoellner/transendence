import { Component } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { GameLobbyChaosService } from 'src/app/services/game-lobby-chaos.service';

@Component({
  selector: 'app-game-rooms-chaos',
  templateUrl: './game-rooms-chaos.component.html',
  styleUrls: ['./game-rooms-chaos.component.scss']
})
export class GameRoomsChaosComponent {
  rooms: any[] = [];

  constructor(private lobbyService: GameLobbyChaosService, private toastr: ToastrService) {}

  ngOnInit() {
    this.fetchRooms();
  }

  fetchRooms() {
    this.lobbyService.getAllRooms().subscribe(
      (rooms) => {
        this.rooms = rooms;
      },
      (error) => this.toastr.error('Failed to fetch game rooms.', 'Error')
    );
  }
}
