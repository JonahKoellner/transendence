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
  pGames: number = 1; // Current page
  itemsPerPageGames: number = 25; // Items per page
  constructor(private lobbyService: GameLobbyChaosService, private toastr: ToastrService) {}

  ngOnInit() {
    this.fetchRooms();
  }

  
  onPageChangeGames(page: number) {
    this.pGames = page;
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
