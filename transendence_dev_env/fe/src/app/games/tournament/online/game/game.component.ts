import { OnInit, OnDestroy, Component, ElementRef, ViewChild, EventEmitter, Output, Input, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GameDisplayService } from 'src/app/services/game-display.service';
import { Subscription } from 'rxjs';
import { SettingsComponent } from 'src/app/settings/settings.component';
import { UserProfile } from 'src/app/profile.service';

interface GameSettings {
  paddleskin_color_left?: string;
  paddleskin_image_left?: string;
  paddleskin_color_right?: string;
  paddleskin_image_right?: string;
  ballskin_color?: string;
  ballskin_image?: string;
  gamebackground_color?: string;
  gamebackground_wallpaper?: string;
}

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit, OnDestroy {
  @Output() gameEnd = new EventEmitter<void>();
  @Input() matchId: string = '';
  @Input() userProfile: UserProfile | null = null;
  private roomId: string = '';
  private messageSubscription!: Subscription;

  //for everything around the canvas
  gameInProgress: boolean = true;
  winner: string = '';
  isReady: boolean = false;
  leftScore: number = 0;
  rightScore: number = 0;

  //TODO make this right, currently use default values
  gameState: any = null;
  gameSettings: GameSettings = {};

  constructor(
    private toastr: ToastrService,
    private gameDisplayService: GameDisplayService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    if (!this.matchId) {
      this.toastr.error('Match ID not provided', 'Error');
      this.gameEnd.emit();
    }
    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    this.gameDisplayService.connect(this.matchId, this.roomId);
    this.gameDisplayService.messages$.subscribe((msg) => {
      if (msg.type !== 'game_state') {
        console.log('Received message:', msg);
      }
      if (msg.type === 'game_state') {
        this.handleGameState(msg);
      } else if (msg.type === 'game_ended') {
        this.handleGameEnd(msg.winner);
      } else if (msg.type === 'game_started') {
        console.log('Game started:', msg);
        this.gameInProgress = true;
      } else if (msg.type === 'game_settings') {
        this.handleGameSettings(msg.settings);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.gameDisplayService.disconnect();
  }

  private handleGameState(msg: any): void {
    let state = msg.state
    if (this.leftScore !== state.left_score || this.rightScore !== state.right_score) {
      console.log('Score updated:', state.left_score, state.right_score);
    }
    this.leftScore = state.left_score;
    this.rightScore = state.right_score;
    this.gameState = msg;
  }

  private handleGameEnd(winner: any) {
    console.log('Game ended:', winner);
    this.gameInProgress = false;
    this.winner = winner;
    this.gameEnd.emit();
  }

  private handleGameSettings(settings: GameSettings): void {
    this.gameSettings = settings;

    this.loadImages()
    .then(() => {
      console.log('Images loaded successfully!');
    })
    .catch((err) => {
      this.toastr.error('Error loading images', 'Error');
    });
  }

  updateReadyStatus() {
    console.log("set status to ready")
    this.isReady = true;
    this.gameDisplayService.sendMessage({
      action: 'set_ready',
      match_id: this.matchId,
      user_id: this.userProfile?.id.toString(),
      is_ready: true
    })
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    console.log("Key down: " + event.code);
    this.gameDisplayService.sendMessage({
      action: 'keydown',
      key: event.code,
    });
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    console.log("Key up: " + event.code);
    this.gameDisplayService.sendMessage({
      action: 'keyup',
      key: event.code,
    });
  }
}
