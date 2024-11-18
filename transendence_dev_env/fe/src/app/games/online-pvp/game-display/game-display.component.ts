import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';

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
  selector: 'app-game-display',
  templateUrl: './game-display.component.html',
  styleUrls: ['./game-display.component.scss']
})
export class GameDisplayComponent implements AfterViewInit, OnChanges {
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

  ngAfterViewInit() {
    const context = this.canvas.nativeElement.getContext('2d');
    if (context) {
      this.context = context;
      this.loadImages().then(() => {
        this.drawGame();
      }).catch(err => {
        console.error('Error loading images:', err);
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
        console.error('Error loading images:', err);
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
          console.warn('Failed to load Left PaddleSkin Image. Falling back to colour.');
          resolve();
        }
      }));
    } else {
      this.paddleImageLeft = null;
    }

    // Load right paddle image if provided
    if (this.gameSettings.paddleskin_image_right) {
      this.paddleImageRight = new Image();
      this.paddleImageRight.src = this.gameSettings.paddleskin_image_right;
      promises.push(new Promise<void>((resolve, reject) => {
        this.paddleImageRight!.onload = () => resolve();
        this.paddleImageRight!.onerror = () => reject(new Error('Failed to load right paddle image'));
      }));
    } else {
      this.paddleImageRight = null;
    }

    // Load ball image if provided
    if (this.gameSettings.ballskin_image) {
      this.ballImage = new Image();
      this.ballImage.src = this.gameSettings.ballskin_image;
      promises.push(new Promise<void>((resolve, reject) => {
        this.ballImage!.onload = () => resolve();
        this.ballImage!.onerror = () => reject(new Error('Failed to load ball image'));
      }));
    } else {
      this.ballImage = null;
    }

    // Load background wallpaper if provided
    if (this.gameSettings.gamebackground_wallpaper) {
      this.backgroundImage = new Image();
      this.backgroundImage.src = this.gameSettings.gamebackground_wallpaper;
      promises.push(new Promise<void>((resolve, reject) => {
        this.backgroundImage!.onload = () => resolve();
        this.backgroundImage!.onerror = () => reject(new Error('Failed to load background image'));
      }));
    } else {
      this.backgroundImage = null;
    }

    return Promise.all(promises).then(() => {
      this.imagesLoaded = true;
    }).catch(err => {
      console.error(err);
      this.imagesLoaded = false;
    });
  }

  /**
   * Draws the entire game state on the canvas.
   */
  drawGame() {
    console.log('Drawing game state:', this.gameSettings);
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
    if (this.backgroundImage && this.imagesLoaded) {
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

    if (side === 'left') {
      if (this.paddleImageLeft && this.imagesLoaded) {
        this.context.drawImage(this.paddleImageLeft, x, y, paddleWidth, paddleHeight);
        return;
      }
    } else if (side === 'right') {
      if (this.paddleImageRight && this.imagesLoaded) {
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
