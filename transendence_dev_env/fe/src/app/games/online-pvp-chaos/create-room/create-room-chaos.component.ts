import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameLobbyChaosService } from 'src/app/services/game-lobby-chaos.service';

export interface GameSettings {
  maxRounds: number;
  roundScoreLimit: number;
  powerupSpawnRate: number;
}
@Component({
  selector: 'app-create-room-chaos',
  templateUrl: './create-room-chaos.component.html',
  styleUrls: ['./create-room-chaos.component.scss']
})
export class CreateRoomChaosComponent {
  roomId: string | null = null;
  settings: GameSettings = {
    maxRounds: 3,
    roundScoreLimit: 3,
    powerupSpawnRate: 10
  };
  constructor(private http: HttpClient, private lobbyService: GameLobbyChaosService, private router: Router) {}

  createRoom() {
    if (!this.validateSettings()) {
      console.error('Invalid settings');
      return;
    }
    this.lobbyService.createRoom(this.settings).subscribe(response => {
      this.roomId = response.room_id;
      this.router.navigate([`/games/online-pvp-chaos/game-room/${this.roomId}`]); 
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
      console.error('Max Rounds must be an integer between 1 and 25.');
      return false;
    }
  
    if (!isRoundScoreLimitValid) {
      console.error('Round Score Limit must be an integer between 1 and 25.');
      return false;
    }
  
    return true;
  }
}
