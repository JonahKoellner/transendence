import { AfterViewInit, Component, ElementRef, ViewChild, EventEmitter, Output, Input, HostListener } from '@angular/core';
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
export class GameComponent implements AfterViewInit {
  @Output() gameEnd = new EventEmitter<void>();
  @ViewChild('gameCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  @Input() matchId: string = '';
  @Input() userProfile: UserProfile | null = null;
  private roomId: string = '';
  context!: CanvasRenderingContext2D;
  private messageSubscription!: Subscription;

  //for everything around the canvas
  game_end: boolean = false;
  winner: string = '';
  isReady: boolean = false;
  leftScore: number = 0;
  rightScore: number = 0;

  gameState: any = null;
  //TODO make this right, currently use default values
  gameSettings: GameSettings = {
    paddleskin_color_left: 'white',
    paddleskin_color_right: 'white',
    ballskin_color: 'white',
    gamebackground_color: 'black',
  };

  // Image elements
  private paddleImageLeft: HTMLImageElement | null = null;
  private paddleImageRight: HTMLImageElement | null = null;
  private ballImage: HTMLImageElement | null = null;
  private backgroundImage: HTMLImageElement | null = null;

  // Flags to check if images are loaded
  private imagesLoaded: boolean = false;

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
        this.handleGameState(msg.data);
      } else if (msg.type === 'game_ended') {
        this.handleGameEnd(msg.winner);
      } else if (msg.type === 'game_settings') {
        this.handleGameSettings(msg.settings);
      }
    });
  }

  ngAfterViewInit() {
    if (!this.canvas) {
      console.error('Canvas not found');
      return;
    }
    const context = this.canvas.nativeElement.getContext('2d');
    if (context) {
      this.context = context;
      // if (this.imagesLoaded) {
      // this.drawGame();
    // } else {
    //   console.warn('Images not loaded yet, Game will be drawn when images are loaded');
    }
  }

  ngOnDestroy(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    this.gameDisplayService.disconnect();
  }

  private handleGameState(state: any): void {
    if (this.leftScore !== state.left_score || this.rightScore !== state.right_score) {
      console.log('Score updated:', state.left_score, state.right_score);
    }
    this.leftScore = state.left_score;
    this.rightScore = state.right_score;
    this.gameState = state;
    if (this.context) {
      this.drawGame();
    }
  }

  private handleGameEnd(winner: any) {
    console.log('Game ended:', winner);
    this.game_end = true;
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

  /**
   * Loads images based on the game settings.
   * Returns a promise that resolves when all images are loaded or skipped if not provided.
   */
  private loadImages(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.gameSettings.paddleskin_image_left) {
      promises.push(this.loadImage(this.gameSettings.paddleskin_image_left, (img) => (this.paddleImageLeft = img)));
    } else {
      this.paddleImageLeft = null;
    }

    if (this.gameSettings.paddleskin_image_right) {
      promises.push(this.loadImage(this.gameSettings.paddleskin_image_right, (img) => (this.paddleImageRight = img)));
    } else {
      this.paddleImageRight = null;
    }

    if (this.gameSettings.ballskin_image) {
      promises.push(this.loadImage(this.gameSettings.ballskin_image, (img) => (this.ballImage = img)));
    } else {
      this.ballImage = null;
    }

    if (this.gameSettings.gamebackground_wallpaper) {
      promises.push(this.loadImage(this.gameSettings.gamebackground_wallpaper, (img) => (this.backgroundImage = img)));
    } else {
      this.backgroundImage = null;
    }

    return Promise.all(promises)
      .then(() => {
        this.imagesLoaded = true;
      })
      .catch((err) => {
        this.imagesLoaded = false;
        throw err;
      });
  }

  /**
   * Helper function to load an image.
   * @param src Image source URL
   * @param assignFn Callback to assign the loaded image
   */
  private loadImage(src: string, assignFn: (img: HTMLImageElement) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        assignFn(img);
        resolve();
      };
      img.onerror = () => {
        this.toastr.warning(`Failed to load image from ${src}`, 'Warning');
        resolve(); // Resolve even on error to avoid blocking
      };
    });
  }

  /**
   * Draws the entire game state on the canvas.
   */
  drawGame() {
    // Draw background
    this.drawBackground();

    // Draw ball
    this.drawBall(this.gameState.ball_x, this.gameState.ball_y);

    // Draw left paddle
    this.drawPaddle(0, this.gameState.left_paddle_y, 'left');

    // Draw right paddle
    this.drawPaddle(990, this.gameState.right_paddle_y, 'right');
  }

  /**
   * Draws the game background using an image or color.
   */
  private drawBackground() {
    if (this.backgroundImage) {
      // Draw the background image stretched to canvas size
      this.context.drawImage(this.backgroundImage, 0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    } else if (this.gameSettings.gamebackground_color) {
      // Fill with background color
      this.context.fillStyle = this.gameSettings.gamebackground_color;
      this.context.fillRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    } else {
      // Default background
      this.context.fillStyle = 'black';
      this.context.fillRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    }
  }

  /**
   * Draws the ball using an image or color.
   * @param x X-coordinate of the ball
   * @param y Y-coordinate of the ball
   */
  drawBall(x: number, y: number) {
    if (this.ballImage && this.imagesLoaded) {
      const ballSize = 30; // Diameter of the ball
      this.context.drawImage(this.ballImage, x - ballSize / 2, y - ballSize / 2, ballSize, ballSize);
    } else if (this.gameSettings.ballskin_color) {
      this.context.beginPath();
      this.context.arc(x, y, 15, 0, 2 * Math.PI);
      this.context.fillStyle = this.gameSettings.ballskin_color;
      this.context.fill();
    } else {
      // Default ball color
      this.context.beginPath();
      this.context.arc(x, y, 15, 0, 2 * Math.PI);
      this.context.fillStyle = 'white';
      this.context.fill();
    }
  }

  /**
   * Draws a paddle using an image or color.
   * @param x X-coordinate of the paddle
   * @param y Y-coordinate of the paddle
   * @param side 'left' or 'right' to determine which paddle to draw
   */
  drawPaddle(x: number, y: number, side: 'left' | 'right') {
    const paddleWidth = 10;
    const paddleHeight = 60;

    // console.log("Draw Paddle: " + (this.paddleImageLeft != null) + " " + this.imagesLoaded);
    if (side === 'left') {
      if (this.paddleImageLeft) {
        this.context.drawImage(this.paddleImageLeft, x, y, paddleWidth, paddleHeight);
        return;
      }
    } else if (side === 'right') {
      if (this.paddleImageRight) {
        this.context.drawImage(this.paddleImageRight, x, y, paddleWidth, paddleHeight);
        return;
      }
    }

    // If no image, use color
    if (side === 'left' && this.gameSettings.paddleskin_color_left) {
      this.context.fillStyle = this.gameSettings.paddleskin_color_left;
    } else if (side === 'right' && this.gameSettings.paddleskin_color_right) {
      this.context.fillStyle = this.gameSettings.paddleskin_color_right;
    } else {
      this.context.fillStyle = 'white'; // Default paddle color
    }

    this.context.fillRect(x, y, paddleWidth, paddleHeight);
  }
}
