import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit,OnDestroy, ViewChild, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TournamentLobbyService } from 'src/app/services/tournament-lobby.service';

@Component({
  selector: 'app-create-room',
  templateUrl: './create-room.component.html',
  styleUrls: ['./create-room.component.scss'],
})
export class CreateRoomComponent implements OnInit, OnDestroy {
  @ViewChild('burst') burst!: ElementRef<HTMLDivElement>;

  roomId: string | null = null;

  // Hold functionality variables
  isHolding: boolean = false;
  holdTimeout: any;
  holdDuration: number = 500; // in milliseconds
  holdProgress: number = 0;
  progressInterval: any;

  constructor(
    private http: HttpClient,
    private lobbyService: TournamentLobbyService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    // No more auto-creation on init
  }

  // Event handlers for mouse
  onMouseDown(): void {
    this.startHold();
  }

  onMouseUp(): void {
    this.endHold();
  }

  onMouseLeave(): void {
    this.endHold();
  }

  // Event handlers for touch
  onTouchStart(): void {
    this.startHold();
  }

  onTouchEnd(): void {
    this.endHold();
  }

  startHold(): void {
    if (this.isHolding) return;
    this.isHolding = true;
    this.holdProgress = 0;

    // Increment progress
    const intervalTime = 50; // update every 50ms
    const increment = (intervalTime / this.holdDuration) * 100;
    this.progressInterval = setInterval(() => {
      this.holdProgress += increment;
      if (this.holdProgress >= 100) {
        this.holdProgress = 100;
        this.createRoom();
        this.endHold();
      }
    }, intervalTime);
  }

  endHold(): void {
    if (!this.isHolding) return;
    this.isHolding = false;
    clearInterval(this.progressInterval);
    this.holdProgress = 0;
  }

  createRoom(): void {
    this.lobbyService.createRoom().subscribe({
      next: (response) => {
        setTimeout(() => {
          this.roomId = response.room_id;
          this.router.navigate([`/games/online-tournament/game-room/${this.roomId}`]);
        }, 500);
      },
      error: (err) => {
        this.toastr.error('Failed to create room. Please try again later.');
        console.error(err);
      },
    });
  }
  ngOnDestroy(): void {
    clearInterval(this.progressInterval);
  }
}
