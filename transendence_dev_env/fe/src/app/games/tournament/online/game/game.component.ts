import { OnInit, OnDestroy, Component, ElementRef, ViewChild, EventEmitter, Output, Input, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { GameDisplayService } from 'src/app/services/game-display.service';
import { Subscription } from 'rxjs';
import { UserProfile } from 'src/app/profile.service';
import { environment } from 'src/environment';

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
  gameInProgress: boolean = false;
  isReady: boolean = false;
  leftScore: number = 0;
  rightScore: number = 0;
  remainingTime: string = '30'; // default value, because each games has 30 seconds
  secsUntilGameStart: string = '5'; // default value because each game starts after 5 seconds

  //TODO make this right, currently use default values
  gameState: any = null;
  gameSettings: GameSettings = {};

  constructor(
    private toastr: ToastrService,
    private gameDisplayService: GameDisplayService,
    private route: ActivatedRoute,
    // private router: Router,
  ) { }

  ngOnInit(): void {
    if (!this.matchId) {
      this.toastr.error('Match ID not provided', 'Error');
      this.gameEnd.emit();
    }

    this.roomId = this.route.snapshot.paramMap.get('roomId') || '';
    this.gameDisplayService.connect(this.matchId, this.roomId);

    // this.updateReadyStatus(); // on init set to ready, so backend knows when both players joined

    this.gameDisplayService.messages$.subscribe((msg) => {
      if (msg.type !== 'game_state') {
        console.log('Received message:', msg);
      }
      if (msg.type === 'game_state') {
        this.handleGameState(msg);
      } else if (msg.type === 'game_ended') {
        this.handleGameEnd();
      } else if (msg.type === 'game_started') {
        console.log('Game started:', msg);
        this.gameInProgress = true;
      } else if (msg.type === 'game_settings') {
        console.log('Game settings:', msg.settings);
        this.gameSettings.paddleskin_color_left = msg.settings.paddleskin_color_left;
        // this.gameSettings.paddleskin_image_left = "http://localhost:8000" + data.paddleskin_image_left;
        this.gameSettings.paddleskin_image_left = environment.apiUrl + msg.settings.paddleskin_image_left;
        this.gameSettings.paddleskin_color_right = msg.settings.paddleskin_color_right;
        // this.gameSettings.paddleskin_image_right = "http://localhost:8000" + data.paddleskin_image_right;
        this.gameSettings.paddleskin_image_right = environment.apiUrl + msg.settings.paddleskin_image_right;
        this.gameSettings.ballskin_color = this.userProfile?.ballskin_color;
        this.gameSettings.ballskin_image = this.userProfile?.ballskin_image;
        this.gameSettings.gamebackground_color = this.userProfile?.gamebackground_color;
        this.gameSettings.gamebackground_wallpaper = this.userProfile?.gamebackground_wallpaper;
      } else if (msg.type === 'match_timer_update') {
        console.log('Remaining time:', msg.remaining_time);
        this.remainingTime = msg.remaining_time;
      } else if (msg.type === 'timer_until_start') {
        console.log('Timer until start:', msg.remaining_time);
        this.secsUntilGameStart = msg.remaining_time;
      } else if (msg.type === 'player_disconnected') {
        console.log('Player disconnected:', msg);
        this.toastr.error('Player disconnected', 'Error');
        this.handleGameEnd();
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
    this.leftScore = msg.leftScore;
    this.rightScore = msg.rightScore;
    this.gameState = msg;
  }

  private handleGameEnd(): void {
    this.gameInProgress = false;
    this.gameEnd.emit();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    this.gameDisplayService.sendMessage({
      action: 'keydown',
      key: event.code,
      user_id: this.userProfile?.id.toString(),
    });
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.gameDisplayService.sendMessage({
      action: 'keyup',
      key: event.code,
      user_id: this.userProfile?.id.toString(),
    });
  }
}
