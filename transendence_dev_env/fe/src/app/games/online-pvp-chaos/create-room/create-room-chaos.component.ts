import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
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
  chaosEnabled: boolean = false;
  settings: GameSettings = {
    maxRounds: 3,
    roundScoreLimit: 3,
    powerupSpawnRate: 10,
  };
  constructor(private http: HttpClient, private lobbyService: GameLobbyChaosService, private router: Router, private toastr: ToastrService) {}

  createRoom() {
    if (!this.validateSettings()) {
      return;
    }
    this.lobbyService.createRoom(this.settings).subscribe(response => {
      this.roomId = response.room_id;
      this.router.navigate([`/games/online-pvp-chaos/game-room/${this.roomId}`]); 
    });
  }
  validateSettings(): boolean {
    let isValid = true;

    // Validate Max Rounds
    const maxRoundsValid =
      Number.isInteger(this.settings.maxRounds) &&
      this.settings.maxRounds >= 1 &&
      this.settings.maxRounds <= 25;

    if (!maxRoundsValid) {
      this.toastr.error('Max Rounds must be an integer between 1 and 25.', 'Error');
      isValid = false;
    }

    // Validate Round Score Limit
    const roundScoreLimitValid =
      Number.isInteger(this.settings.roundScoreLimit) &&
      this.settings.roundScoreLimit >= 1 &&
      this.settings.roundScoreLimit <= 25;

    if (!roundScoreLimitValid) {
      this.toastr.error('Round Score Limit must be an integer between 1 and 25.', 'Error');
      isValid = false;
    }

    // Validate Powerup Spawn Rate
    const powerupSpawnRateValid = this.validatePowerupSpawnRate();

    if (!powerupSpawnRateValid) {
      isValid = false;
    }

    return isValid;
  }
  private validatePowerupSpawnRate(): boolean {
    const value = this.settings.powerupSpawnRate;

    if (this.chaosEnabled) {
      if (value < 0.1 || value > 25) {
        this.toastr.error('Powerup Spawn Rate must be between 0.1 and 25.', 'Error');
        return false;
      }
      // Allow up to one decimal place
      if (!/^(\d+)(\.\d)?$/.test(value.toString())) {
        this.toastr.error('Powerup Spawn Rate must be a whole number or one decimal place.', 'Error');
        return false;
      }
    } else {
      if (!Number.isInteger(value) || value < 1 || value > 25) {
        this.toastr.error('Powerup Spawn Rate must be an integer between 1 and 25.', 'Error');
        return false;
      }
    }

    return true;
  }
}