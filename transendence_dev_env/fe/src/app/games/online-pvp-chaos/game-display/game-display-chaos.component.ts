import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

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

interface PowerUp {
  x: number;
  y: number;
  type: string;
}

@Component({
  selector: 'app-game-display-chaos',
  templateUrl: './game-display-chaos.component.html',
  styleUrls: ['./game-display-chaos.component.scss']
})
export class GameDisplayChaosComponent implements AfterViewInit, OnChanges {
  @Input() gameState: any;
  @Input() gameSettings!: GameSettings;
  @ViewChild('gameCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  context!: CanvasRenderingContext2D;

  // Image elements
  private paddleImageLeft: HTMLImageElement | null = null;
  private paddleImageRight: HTMLImageElement | null = null;
  private ballImage: HTMLImageElement | null = null;
  private backgroundImage: HTMLImageElement | null = null;

  // Flags to check if images are loaded
  private imagesLoaded: boolean = false;

  constructor(private toastr: ToastrService) { }

  ngAfterViewInit() {
    const context = this.canvas.nativeElement.getContext('2d');
    if (context) {
      this.context = context;
      this.loadImages().then(() => {
        this.drawGame();
      }).catch(err => {
        this.toastr.error('Error loading images', 'Error');
        this.drawGame(); // Fallback to colors if images fail to load
      });
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gameSettings']) {
      this.loadImages().then(() => {
        if (this.context) {
          this.drawGame();
        }
      }).catch(err => {
        this.toastr.error('Error loading images', 'Error');
        if (this.context) {
          this.drawGame(); // Fallback to colors if images fail to load
        }
      });
    }

    if (changes['gameState'] && this.context) {
      this.drawGame();
    }
  }

  /**
   * Loads images based on the game settings.
   * Returns a promise that resolves when all images are loaded or skipped if not provided.
   */
  private loadImages(): Promise<void> {
    const promises: Promise<void>[] = [];

    // Load left paddle image if provided
    if (this.gameSettings.paddleskin_image_left) {
      promises.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.src = this.gameSettings.paddleskin_image_left!;
        img.onload = () => {
          this.paddleImageLeft = img;
          resolve();
        }
        img.onerror = () => {
          this.toastr.warning('Failed to load Left PaddleSkin Image. Falling back to colour.', 'Warning');
          resolve();
        }
      }));
    } else {
      this.paddleImageLeft = null;
    }

    // Load right paddle image if provided
    if (this.gameSettings.paddleskin_image_right) {
      promises.push(new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = this.gameSettings.paddleskin_image_right!;
        img.onload = () => {
          this.paddleImageRight = img;
          resolve();
        }
        img.onerror = () => {
          this.toastr.warning('Failed to load Right PaddleSkin Image. Falling back to colour.', 'Warning');
          resolve();
        }
      }));
    } else {
      this.paddleImageRight = null;
    }

    // Load ball image if provided
    if (this.gameSettings.ballskin_image) {
      promises.push(new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = this.gameSettings.ballskin_image!;
        img.onload = () => {
          this.ballImage = img;
          resolve();
        }
        img.onerror = () => {
          this.toastr.warning('Failed to load Ball Skin Image. Falling back to colour.', 'Warning');
          resolve();
        }
      }));
    } else {
      this.ballImage = null;
    }

    // Load background wallpaper if provided
    if (this.gameSettings.gamebackground_wallpaper) {
      promises.push(new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = this.gameSettings.gamebackground_wallpaper!;
        img.onload = () => {
          this.backgroundImage = img;
          resolve();
        }
        img.onerror = () => {
          this.toastr.warning('Failed to load Background Image. Falling back to colour.', 'Warning');
          resolve();
        }
      }));
    } else {
      this.backgroundImage = null;
    }

    return Promise.all(promises).then(() => {
      this.imagesLoaded = true;
    }).catch(err => {
      this.toastr.error('Failed to load images.', 'Error');
      this.imagesLoaded = false;
    });
  }

  /**
   * Draws the entire game state on the canvas.
   */
  drawGame() {
    console.log('Game state:', this.gameState);

    // Draw background
    this.drawBackground();

    // Draw power-ups
    this.drawPowerUps();

    // Draw ball
    this.drawBall(this.gameState.ball_x, this.gameState.ball_y);

    // Draw left paddle
    this.drawPaddle(0, this.gameState.left_paddle_y, 'left');

    // Draw right paddle
    this.drawPaddle(990, this.gameState.right_paddle_y, 'right');

  }

  drawPowerUps() {
    const powerUpData: { [key: string]: { color: string; icon: string } } = {
      enlargePaddle: { color: 'green', icon: '⇧' },  // Up arrow
      shrinkPaddle: { color: 'red', icon: '⇩' },    // Down arrow
      slowBall: { color: 'purple', icon: '🐢' },    // Turtle
      fastBall: { color: 'orange', icon: '🔥' },    // Fire
      teleportBall: { color: 'cyan', icon: '✈️' },  // Airplane
      shrinkBall: { color: 'brown', icon: '🔽' },  // Downward arrow
      growBall: { color: 'lime', icon: '🔼' },     // Upward arrow
    };
  const activePowerUps: PowerUp[] = this.gameState.active_power_ups || [];
  for (const powerUp of activePowerUps) {
    const { color, icon } = powerUpData[powerUp.type] || { color: 'white', icon: '?' };

    // Draw the power-up circle
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.arc(powerUp.x, powerUp.y, 15, 0, 2 * Math.PI);
    this.context.closePath();
    this.context.fill();

    // Draw the power-up icon
    this.context.fillStyle = 'black'; // Icon/Text color
    this.context.font = 'bold 16px Arial'; // Icon font
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(icon, powerUp.x, powerUp.y);
  }
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
    const ballSize = 30 * this.gameState.paddle_size_modifier; // Diameter of the ball
    if (this.ballImage && this.imagesLoaded) {
      this.context.drawImage(this.ballImage, x - ballSize / 2, y - ballSize / 2, ballSize, ballSize);
    } else if (this.gameSettings.ballskin_color) {
      this.context.beginPath();
      this.context.arc(x, y, ballSize / 2, 0, 2 * Math.PI);
      this.context.fillStyle = this.gameSettings.ballskin_color;
      this.context.fill();
    } else {
      // Default ball color
      this.context.beginPath();
      this.context.arc(x, y, ballSize / 2, 0, 2 * Math.PI);
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
    const paddleHeight = 60 * this.gameState.paddle_size_modifier;

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
