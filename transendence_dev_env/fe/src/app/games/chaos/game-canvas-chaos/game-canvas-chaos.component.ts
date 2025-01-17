import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { GameSettings } from '../chaos.component';

@Component({
  selector: 'app-game-canvas-chaos',
  templateUrl: './game-canvas-chaos.component.html',
  styleUrls: ['./game-canvas-chaos.component.scss']
})
export class GameCanvasChaosComponent implements AfterViewInit {
  @ViewChild('GameCanvas', { read: ElementRef, static: false }) canvas!: ElementRef;
  context!: CanvasRenderingContext2D;

  @Input() gameSettings!: GameSettings;
  @Output() onScore = new EventEmitter<"human" | "bot">();

  updateScore(player: "human" | "bot") {
    this.onScore.emit(player);
  }

  // Game controller data
  readonly canvasWidth = 1000;
  readonly canvasHeight = 500;
  ballRadius = 15;
  readonly paddleWidth = 10;
  paddleHeight = 60;
  readonly dashCount = 41;
  readonly dashWidth = 10;
  readonly scoreToWin = 5;

  round: number = 0;
  intervalID!: number;
  aiIntervalID!: number;
  leftPaddleSpeed!: number;
  rightPaddleSpeed!: number;
  leftPaddleY!: number;
  rightPaddleY!: number;
  ballX!: number;
  ballY!: number;
  ballDirectionX!: number;
  ballDirectionY!: number;
  ballSpeed!: number;
  leftScore!: number;
  rightScore!: number;

  // AI parameters
  aiTargetY: number = this.canvasHeight / 2;
  aiMoveSpeed: number = 5; // Default value, will be set based on difficulty
  predictionRandomness: number = 10; // Default value, will be set based on difficulty
  aiUpdateInterval: number = 1000; // Default update interval in ms

  // **Image Properties**
  leftPaddleImage: HTMLImageElement | null = null;
  ballImage: HTMLImageElement | null = null;
  backgroundImage: HTMLImageElement | null = null;

  powerUpsEnabled: boolean = true; // Enable/disable power-ups
  activePowerUps: { x: number; y: number; type: string }[] = [];
  powerUpEffects: { [key: string]: (player: "human" | "bot") => void } = {};
  lastHit: "human" | "bot" | null = null;
  powerUpIntervalID!: number;

  ngAfterViewInit() {
    this.context = this.canvas.nativeElement.getContext('2d')!;
    this.loadImages().then(() => {
      this.setAIParameters(); // Set AI parameters based on difficulty
      this.resetRound();
      this.startGame();
      this.aiIntervalID = window.setInterval(() => this.updateAI(), this.aiUpdateInterval); // AI updates based on interval
      if (this.powerUpsEnabled) {
        this.initializePowerUps();
        this.powerUpIntervalID = window.setInterval(() => this.spawnPowerUp(), this.gameSettings.powerUpSpawnInterval * 1000);
      }
    }).catch(error => {
      console.error('Error loading images:', error);
      // Proceed with default settings if images fail to load
      this.setAIParameters();
      this.resetRound();
      this.startGame();

      this.aiIntervalID = window.setInterval(() => this.updateAI(), this.aiUpdateInterval);
      if (this.powerUpsEnabled) {
        this.initializePowerUps();
        this.powerUpIntervalID = window.setInterval(() => this.spawnPowerUp(), this.gameSettings.powerUpSpawnInterval * 1000);
      }
    });
  }

  /**
   * Loads images based on the game settings.
   * @returns Promise that resolves when all images are loaded or skipped if not provided.
   */
  loadImages(): Promise<void> {
    const promises: Promise<void>[] = [];

    // Load Left Paddle Image
    if (this.gameSettings.paddleskin_image) {
      promises.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.src = this.gameSettings.paddleskin_image!;
        img.onload = () => {
          this.leftPaddleImage = img;
          resolve();
        };
        img.onerror = () => {
          resolve(); // Resolve to continue without rejecting
        };
      }));
    }

    // Load Ball Image
    if (this.gameSettings.ballskin_image) {
      promises.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.src = this.gameSettings.ballskin_image!;
        img.onload = () => {
          this.ballImage = img;
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
      }));
    }

    // Load Background Image
    if (this.gameSettings.gamebackground_wallpaper) {
      promises.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.src = this.gameSettings.gamebackground_wallpaper!;
        img.onload = () => {
          this.backgroundImage = img;
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
      }));
    }

    return Promise.all(promises).then(() => {});
  }

  // Method to set AI parameters based on selected difficulty
  setAIParameters() {
    switch (this.gameSettings.difficulty) {
      case 'Easy':
        this.aiMoveSpeed = 3;
        this.predictionRandomness = 20;
        this.aiUpdateInterval = 1200; // AI updates less frequently
        break;
      case 'Medium':
        this.aiMoveSpeed = 5;
        this.predictionRandomness = 10;
        this.aiUpdateInterval = 1000; // Default interval
        break;
      case 'Hard':
        this.aiMoveSpeed = 7;
        this.predictionRandomness = 5;
        this.aiUpdateInterval = 800; // AI updates more frequently
        break;
      default:
        this.aiMoveSpeed = 5;
        this.predictionRandomness = 10;
        this.aiUpdateInterval = 1000;
    }
  }

  initializePowerUps() {
    this.powerUpEffects = {
      enlargePaddle: (player: "human" | "bot") => {
        const paddleHeightModifier = 1.5;
        if (player === "human") this.paddleHeight *= paddleHeightModifier;
        else if (player === "bot") this.paddleHeight *= paddleHeightModifier;
        setTimeout(() => this.paddleHeight /= paddleHeightModifier, 5000);
      },
      shrinkPaddle: (player: "human" | "bot") => {
        const paddleHeightModifier = 0.5;
        if (player === "human") this.paddleHeight *= paddleHeightModifier;
        else if (player === "bot") this.paddleHeight *= paddleHeightModifier;
        setTimeout(() => this.paddleHeight /= paddleHeightModifier, 5000);
      },
      slowBall: () => {
        this.ballSpeed *= 0.7;
        setTimeout(() => this.ballSpeed /= 0.7, 5000);
      },
      fastBall: () => {
        this.ballSpeed *= 1.3;
        setTimeout(() => this.ballSpeed /= 1.3, 5000);
      },
      teleportBall: () => {
        // Teleport the ball to a random position
        this.ballX = Math.random() * this.canvasWidth;
        this.ballY = Math.random() * this.canvasHeight;
      },
      shrinkBall: () => {
        const originalBallRadius = this.ballRadius;
        this.ballRadius = Math.max(5, this.ballRadius * 0.5); // Shrink but keep a minimum size
        setTimeout(() => (this.ballRadius = originalBallRadius), 5000);
      },
      growBall: () => {
        const originalBallRadius = this.ballRadius;
        this.ballRadius = Math.min(50, this.ballRadius * 2); // Grow but keep a maximum size
        setTimeout(() => (this.ballRadius = originalBallRadius), 5000);
      },
    };
  }

  resetControls() {
    this.onKeyDown = (e: any) => {
      if (e.code === 'KeyW') this.leftPaddleSpeed = -10;
      if (e.code === 'KeyS') this.leftPaddleSpeed = 10;
    };
    this.onKeyUp = (e: any) => {
      if (e.code === 'KeyW' || e.code === 'KeyS') this.leftPaddleSpeed = 0;
    };
  }
  
  spawnPowerUp() {
    const x = Math.random() * (this.canvasWidth - 50) + 25;
    const y = Math.random() * (this.canvasHeight - 50) + 25;
    const types = Object.keys(this.powerUpEffects);
    const type = types[Math.floor(Math.random() * types.length)];
    
    this.activePowerUps.push({ x, y, type });
  }

  drawPowerUps() {
    const powerUpData: { [key: string]: { color: string; icon: string } } = {
      enlargePaddle: { color: 'green', icon: '⇧' },  // Up arrow
      shrinkPaddle: { color: 'red', icon: '⇩' },    // Down arrow
      slowBall: { color: 'purple', icon: '🐢' },    // Turtle
      fastBall: { color: 'orange', icon: '🔥' },    // Fire
      teleportBall: { color: 'cyan', icon: '✈️' },  // Airplane
      shrinkBall: { color: 'brown', icon: '🔽' },   // Downward arrow
      growBall: { color: 'lime', icon: '🔼' },      // Upward arrow
    };

    for (const powerUp of this.activePowerUps) {
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


  checkPowerUpCollection() {
    this.activePowerUps = this.activePowerUps.filter(powerUp => {
      const distance = Math.sqrt(
        Math.pow(this.ballX - powerUp.x, 2) + Math.pow(this.ballY - powerUp.y, 2)
      );
      if (distance < this.ballRadius + 15) {
        if (this.lastHit && this.powerUpEffects[powerUp.type]) {
          this.powerUpEffects[powerUp.type](this.lastHit);
        }
        return false;
      }
      return true;
    });
  }

  resetRound() {
    this.round += 1;
    this.leftPaddleSpeed = 0;
    this.rightPaddleSpeed = 0;
    this.leftPaddleY = this.canvasHeight / 2;
    this.rightPaddleY = this.canvasHeight / 2;
    this.resetBall();
    this.leftScore = 0;
    this.rightScore = 0;
    if (this.round >= this.gameSettings.maxRounds
      && (this.leftScore >= this.gameSettings.roundScoreLimit
        || this.rightScore >= this.gameSettings.roundScoreLimit))
      this.endGame();
  }

  startGame() {
    this.intervalID = window.setInterval(() => this.updateGame(), 1000 / 60);
  }

  resetBall() {
    this.ballX = this.canvasWidth / 2;
    this.ballY = this.canvasHeight / 2;

    // Randomly set the ball direction to left or right
    this.ballDirectionX = Math.random() < 0.5 ? -1 : 1;

    // Set the ball direction Y to a small random value to avoid straight horizontal movement
    this.ballDirectionY = (Math.random() * 2 - 1) * 0.5; // Random value between -0.5 and 0.5

    this.ballSpeed = 5;
  }

  /**
   * Draws the game background.
   * Priority:
   * 1. Background Image
   * 2. Background Color
   * 3. Default Black
   */
  drawBackground() {
    if (this.backgroundImage) {
      // Draw the background image scaled to the canvas size
      this.context.drawImage(this.backgroundImage, 0, 0, this.canvasWidth, this.canvasHeight);
    } else if (this.gameSettings.gamebackground_color) {
      // Use the specified background color
      this.context.fillStyle = this.gameSettings.gamebackground_color!;
      this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    } else {
      // Default to black background
      this.context.fillStyle = 'black';
      this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
  }

  drawCenter() {
    this.context.fillStyle = 'white';
    for (let i = 0; i < this.dashCount; i++) {
      if (i % 2 == 0)
        this.context.fillRect(this.canvasWidth / 2 - this.dashWidth / 2,
          i * this.canvasHeight / this.dashCount,
          this.dashWidth,
          this.canvasHeight / this.dashCount);
    }
  }

  drawScore() {
    this.context.fillStyle = 'white';
    this.context.font = '30px Sans-serif';
    this.context.fillText(this.leftScore.toString(), this.canvasWidth / 4, this.canvasHeight / 2);
    this.context.fillText(this.rightScore.toString(), 3 * (this.canvasWidth / 4), this.canvasHeight / 2);
  }

  /**
   * Draws the game ball.
   * Priority:
   * 1. Ball Image (maintaining aspect ratio)
   * 2. Ball Color
   * 3. Default White
   */
  drawBall(x: number, y: number) {
    if (this.ballImage) {
      // Calculate image dimensions to maintain aspect ratio
      const imgWidth = this.ballImage.width;
      const imgHeight = this.ballImage.height;
      
      // Desired dimensions based on ball size
      const desiredWidth = this.ballRadius * 2;
      const desiredHeight = this.ballRadius * 2;
      
      // Calculate scaling factor to fit image within ball dimensions
      const scale = Math.min(desiredWidth / imgWidth, desiredHeight / imgHeight);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      // Calculate position to center the image within the ball area
      const drawX = x - drawWidth / 2;
      const drawY = y - drawHeight / 2;

      // Draw the ball image centered at (x, y)
      this.context.drawImage(
        this.ballImage,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
    } else {
      // Use the specified ball color or default to white
      const ballColor = this.gameSettings.ballskin_color || 'white';
      this.context.fillStyle = ballColor;
      this.context.beginPath();
      this.context.arc(x, y, this.ballRadius, 0, 2 * Math.PI);
      this.context.closePath();
      this.context.fill();
    }
  }

  /**
   * Draws the game paddles.
   * Priority for Left Paddle (Player):
   * 1. Paddle Image (maintaining aspect ratio)
   * 2. Paddle Color
   * 3. Default White
   * 
   * Right Paddle (AI) remains white by default.
   */
  drawPaddle(x: number, y: number) {
    if (x === 0) { // Left Paddle (Player)
      if (this.leftPaddleImage) {
        // Draw the paddle image stretched to match the paddle dimensions
        const drawX = x;
        const drawY = y - this.paddleHeight / 2;
  
        // Stretch the image to fit the paddle dimensions
        this.context.drawImage(
          this.leftPaddleImage,
          drawX,
          drawY,
          this.paddleWidth,
          this.paddleHeight
        );
      } else {
        // Use the specified paddle color or default to white
        const paddleColor = this.gameSettings.paddleskin_color || 'white';
        this.context.fillStyle = paddleColor;
        this.context.fillRect(x, y - this.paddleHeight / 2, this.paddleWidth, this.paddleHeight);
      }
    } else { // Right Paddle (AI) - Keep Default Styling
      this.context.fillStyle = 'white';
      this.context.fillRect(x, y - this.paddleHeight / 2, this.paddleWidth, this.paddleHeight);
    }
  }

  enforcePaddleBounds() {
    this.leftPaddleY += this.leftPaddleSpeed;
    this.rightPaddleY += this.rightPaddleSpeed;

    if (this.leftPaddleY - this.paddleHeight / 2 < 0)
      this.leftPaddleY = this.paddleHeight / 2;
    else if (this.leftPaddleY + this.paddleHeight / 2 > this.canvasHeight)
      this.leftPaddleY = this.canvasHeight - this.paddleHeight / 2;

    if (this.rightPaddleY - this.paddleHeight / 2 < 0)
      this.rightPaddleY = this.paddleHeight / 2;
    else if (this.rightPaddleY + this.paddleHeight / 2 > this.canvasHeight)
      this.rightPaddleY = this.canvasHeight - this.paddleHeight / 2;
  }

  checkRoofCollision() {
    if (this.ballY + (this.ballDirectionY * this.ballSpeed) - this.ballRadius <= 0)
      this.ballDirectionY *= -1;
    else if (this.ballY + (this.ballDirectionY * this.ballSpeed) + this.ballRadius >= this.canvasHeight)
      this.ballDirectionY *= -1;
  }

  checkPaddleCollision() {
    const diffBallLeftPaddle = this.ballY - this.leftPaddleY;
    const diffBallRightPaddle = this.ballY - this.rightPaddleY;

    if (this.ballX + (this.ballDirectionX * this.ballSpeed) - this.ballRadius <= this.paddleWidth) {
      this.paddleCollision(diffBallLeftPaddle);
    }
    else if (this.ballX + (this.ballDirectionX * this.ballSpeed) + this.ballRadius >= this.canvasWidth - this.paddleWidth) {
      this.paddleCollision(diffBallRightPaddle);
    }
  }

  paddleCollision(ballPaddleDiff: number) {
    if (ballPaddleDiff > -this.paddleHeight / 2 - this.ballRadius && ballPaddleDiff < this.paddleHeight / 2 + this.ballRadius) {
      this.ballDirectionX *= -1;
      this.lastHit = this.ballDirectionX < 0 ? "human" : "bot";
      if (ballPaddleDiff < 0) {
        if (ballPaddleDiff <= (-this.paddleHeight / 4))
          this.ballDirectionY = -1.1;
        else if (ballPaddleDiff <= (-this.paddleHeight / 4) * 2)
          this.ballDirectionY = -1.3;
        else if (ballPaddleDiff <= (-this.paddleHeight / 4) * 3)
          this.ballDirectionY = -1.6;
        else if (ballPaddleDiff <= -this.paddleHeight / 2)
          this.ballDirectionY = -1.9;
      }
      else if (ballPaddleDiff > 0) {
        if (ballPaddleDiff <= (this.paddleHeight / 4))
          this.ballDirectionY = 1.1;
        else if (ballPaddleDiff <= (this.paddleHeight / 4) * 2)
          this.ballDirectionY = 1.3;
        else if (ballPaddleDiff <= (this.paddleHeight / 4) * 3)
          this.ballDirectionY = 1.6;
        else if (ballPaddleDiff <= this.paddleHeight / 2)
          this.ballDirectionY = 1.9;
      }
      else
        this.ballDirectionY = 0;
      if (this.ballSpeed < 100)
        this.ballSpeed *= 1.05;
    }
  }

  checkScore() {
    if (this.ballX - this.ballRadius < this.paddleWidth) {
      this.rightScore++;
      this.updateScore("bot");
      this.resetBall();
    }
    else if (this.ballX + this.ballRadius > this.canvasWidth - this.paddleWidth) {
      this.leftScore++;
      this.updateScore("human");
      this.resetBall();
    }

    if (this.leftScore >= this.gameSettings.roundScoreLimit
      || this.rightScore >= this.gameSettings.roundScoreLimit)
      this.resetRound();
  }

  updateBallPos() {
    this.ballX += this.ballDirectionX * this.ballSpeed;
    this.ballY += this.ballDirectionY * this.ballSpeed;
  }

  updateGame() {
    this.checkRoofCollision();
    this.checkPaddleCollision();
    this.checkScore();
    this.updateBallPos();
    this.moveAI(); // AI paddle movement
    this.enforcePaddleBounds();
    this.checkPowerUpCollection();
    this.drawBackground();
    this.drawCenter();
    this.drawScore();
    this.drawBall(this.ballX, this.ballY);
    this.drawPaddle(0, this.leftPaddleY);
    this.drawPaddle(this.canvasWidth - this.paddleWidth, this.rightPaddleY);
    this.drawPowerUps();
  }

  endGame() {
    window.clearInterval(this.intervalID);
    window.clearInterval(this.aiIntervalID);
    if (this.powerUpsEnabled) window.clearInterval(this.powerUpIntervalID);
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: any) {
    if (e.code === 'KeyW') {
      this.leftPaddleSpeed = -10;
    }
    if (e.code === 'KeyS') {
      this.leftPaddleSpeed = 10;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: any) {
    if (e.code === 'KeyW' || e.code === 'KeyS') {
      this.leftPaddleSpeed = 0;
    }
  }

  // AI Implementation with Power-Up Consideration
  updateAI() {
    let targetY = this.canvasHeight / 2; // Default target

    // Check if there are active power-ups
    if (this.activePowerUps.length > 0) {
      // Find the most relevant power-up to target
      // For simplicity, prioritize the closest power-up
      let closestPowerUp: { x: number; y: number; type: string } | null = null;
      let minDistance = Infinity;

      for (const powerUp of this.activePowerUps) {
        const distance = Math.sqrt(Math.pow(this.ballX - powerUp.x, 2) + Math.pow(this.ballY - powerUp.y, 2));
        if (distance < minDistance) {
          minDistance = distance;
          closestPowerUp = powerUp;
        }
      }

      if (closestPowerUp) {
        // Predict if the ball will collide with this power-up
        const predictedYAtPowerUp = this.predictBallYAtX(
          this.ballX,
          this.ballY,
          this.ballDirectionX,
          this.ballDirectionY,
          this.ballSpeed,
          closestPowerUp.x
        );

        // Check if the predicted Y is within the power-up's radius
        const distanceToPowerUp = Math.abs(predictedYAtPowerUp - closestPowerUp.y);
        if (distanceToPowerUp <= 15 + this.ballRadius) { // Power-up radius is 15
          // Set targetY to the power-up's Y position to be the last hitter
          targetY = closestPowerUp.y;
        } else {
          // No collision predicted with the closest power-up, proceed normally
          targetY = this.predictBallYAtPaddle(
            this.ballX,
            this.ballY,
            this.ballDirectionX,
            this.ballDirectionY,
            this.ballSpeed,
            this.canvasWidth - this.paddleWidth
          );
        }
      }
    } else {
      // No active power-ups, proceed normally
      targetY = this.predictBallYAtPaddle(
        this.ballX,
        this.ballY,
        this.ballDirectionX,
        this.ballDirectionY,
        this.ballSpeed,
        this.canvasWidth - this.paddleWidth
      );
    }

    // Add randomness based on difficulty to simulate human-like behavior
    targetY += (Math.random() - 0.5) * this.predictionRandomness; // Random offset

    // Clamp targetY to ensure it stays within the canvas
    targetY = Math.max(this.ballRadius, Math.min(this.canvasHeight - this.ballRadius, targetY));

    // Set the AI's target Y position
    this.aiTargetY = targetY;
  }

  moveAI() {
    // AI paddle moves towards aiTargetY at a fixed speed
    if (this.rightPaddleY < this.aiTargetY - 10) {
      this.rightPaddleSpeed = this.aiMoveSpeed;
    } else if (this.rightPaddleY > this.aiTargetY + 10) {
      this.rightPaddleSpeed = -this.aiMoveSpeed;
    } else {
      this.rightPaddleSpeed = 0;
    }
  }

  predictBallYAtPaddle(
    ballX: number,
    ballY: number,
    directionX: number,
    directionY: number,
    speed: number,
    targetX: number
  ): number {
    let x = ballX;
    let y = ballY;
    let dirX = directionX;
    let dirY = directionY;
    let ballSpeed = speed;

    // Copy of constants
    const canvasWidth = this.canvasWidth;
    const canvasHeight = this.canvasHeight;
    const ballRadius = this.ballRadius;

    while (true) {
      // Move the ball
      x += dirX * ballSpeed;
      y += dirY * ballSpeed;

      // Check for collisions with top and bottom walls
      if (y - ballRadius < 0) {
        y = ballRadius;
        dirY *= -1;
      } else if (y + ballRadius > canvasHeight) {
        y = canvasHeight - ballRadius;
        dirY *= -1;
      }

      // Check if the ball has reached or passed the target x-position
      if ((dirX > 0 && x >= targetX) || (dirX < 0 && x <= targetX)) {
        // If the ball is moving away from the AI paddle, center the AI paddle
        if ((dirX > 0 && targetX < this.ballX) || (dirX < 0 && targetX > this.ballX)) {
          return this.canvasHeight / 2;
        }
        return y;
      }
    }
  }

  /**
   * Predicts the Y position of the ball when it reaches a specific X position.
   * This function accounts for wall bounces.
   * @param ballX Current X position of the ball
   * @param ballY Current Y position of the ball
   * @param directionX X direction of the ball (-1 or 1)
   * @param directionY Y direction of the ball
   * @param speed Speed of the ball
   * @param targetX The X position to predict the Y for
   * @returns Predicted Y position
   */
  predictBallYAtX(
    ballX: number,
    ballY: number,
    directionX: number,
    directionY: number,
    speed: number,
    targetX: number
  ): number {
    let x = ballX;
    let y = ballY;
    let dirX = directionX;
    let dirY = directionY;
    const ballRadius = this.ballRadius;
    const canvasHeight = this.canvasHeight;

    while (true) {
      // Calculate the next position
      x += dirX * speed;
      y += dirY * speed;

      // Check for wall collisions
      if (y - ballRadius < 0) {
        y = ballRadius;
        dirY *= -1;
      } else if (y + ballRadius > canvasHeight) {
        y = canvasHeight - ballRadius;
        dirY *= -1;
      }

      // Check if the ball has reached or passed the target X
      if ((dirX > 0 && x >= targetX) || (dirX < 0 && x <= targetX)) {
        return y;
      }
    }
  }
}
