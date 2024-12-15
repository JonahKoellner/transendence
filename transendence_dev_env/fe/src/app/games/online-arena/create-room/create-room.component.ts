import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GameLobbyArenaService } from 'src/app/services/game-lobby-arena.service';

export interface GameSettings {
  maxRounds: number;
  roundScoreLimit: number;
}
@Component({
  selector: 'app-create-room',
  templateUrl: './create-room.component.html',
  styleUrls: ['./create-room.component.scss']
})
export class CreateRoomArenaComponent {
  roomId: string | null = null;
  settings: GameSettings = {
    maxRounds: 3,
    roundScoreLimit: 3
  };
  constructor(private http: HttpClient, private lobbyService: GameLobbyArenaService, private router: Router, private toastr: ToastrService) {}

  createRoom() {
    if (!this.validateSettings()) {
      return;
    }
    this.lobbyService.createRoom(this.settings).subscribe(response => {
      this.roomId = response.room_id;
      this.router.navigate([`/games/online-arena/game-room/${this.roomId}`]); 
    });
  }
  validateSettings(): boolean {
    const isMaxRoundsValid =
      Number.isInteger(this.settings.maxRounds) &&
      this.settings.maxRounds >= 1 &&
      this.settings.maxRounds <= 25;

    const isRoundScoreLimitValid =
      Number.isInteger(this.settings.roundScoreLimit) &&
      this.settings.roundScoreLimit >= 1 &&
      this.settings.roundScoreLimit <= 25;

    if (!isMaxRoundsValid) {
      this.toastr.error('Max Rounds must be an integer between 1 and 25.');
      return false;
    }

    if (!isRoundScoreLimitValid) {
      this.toastr.error('Round Score Limit must be an integer between 1 and 25.');
      return false;
    }

    return true;
  }
}
