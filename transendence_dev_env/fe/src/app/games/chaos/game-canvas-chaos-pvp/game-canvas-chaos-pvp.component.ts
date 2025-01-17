
import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { GameSettings } from '../chaos.component';

@Component({
  selector: 'app-game-canvas-chaos-pvp',
  templateUrl: './game-canvas-chaos-pvp.component.html',
  styleUrls: ['./game-canvas-chaos-pvp.component.scss']
})
export class GameCanvasChaosPvpComponent implements AfterViewInit {
  @ViewChild('GameCanvasPvP', {read: ElementRef, static: false}) canvas!: ElementRef;
  context!: CanvasRenderingContext2D;

  @Input() gameSettings!: GameSettings;
  @Output() onScore = new EventEmitter<"player1" | "player2">();

  // Game controller data
  readonly canvasWidth = 1000;
  readonly canvasHeight = 500;
  ballRadius = 15;
  readonly paddleWidth = 10;
  paddleHeight = 60;  // Updated to match other component's paddle height
  readonly dashCount = 41;
  readonly dashWidth = 10;
  readonly scoreToWin = 5;

  round: number = 0;
  intervalID!: number;
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

  // **Image Properties**
  leftPaddleImage: HTMLImageElement | null = null;
  rightPaddleImage: HTMLImageElement | null = null;
  ballImage: HTMLImageElement | null = null;
  backgroundImage: HTMLImageElement | null = null;

  powerUpsEnabled: boolean = true; // Enable/disable power-ups
  // powerUpSpawnInterval: number = 10000; // Spawn every 10 seconds
  activePowerUps: { x: number; y: number; type: string }[] = [];
  powerUpEffects: { [key: string]: (player: "player1" | "player2") => void } = {};
  lastHit: "player1" | "player2" | null = null;
  powerUpIntervalID!: number;

  ngAfterViewInit() {
    this.context = this.canvas.nativeElement.getContext('2d')!;
    this.loadImages().then(() => {
      this.resetRound();
      this.startGame();
      if (this.powerUpsEnabled) {
        this.initializePowerUps();
        this.powerUpIntervalID = window.setInterval(() => this.spawnPowerUp(), this.gameSettings.powerUpSpawnInterval * 1000);
      }
    }).catch(error => {
      this.resetRound();
      this.startGame();
      if (this.powerUpsEnabled) {
        this.initializePowerUps();
        this.powerUpIntervalID = window.setInterval(() => this.spawnPowerUp(), this.gameSettings.powerUpSpawnInterval * 1000);
      }
    });
  }

  loadImages(): Promise<void> {
    const promises: Promise<void>[] = [];
  
    // Load Left Paddle Image
    if (this.gameSettings.paddleskin_image) {
      promises.push(new Promise((resolve) => {
        const img = new Image();
        img.src = this.gameSettings.paddleskin_image || ''; // Fallback empty string
        img.onload = () => {
          this.leftPaddleImage = img;
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
      }));
    }
  
    // Load Ball Image
    if (this.gameSettings.ballskin_image) {
      promises.push(new Promise((resolve) => {
        const img = new Image();
        img.src = this.gameSettings.ballskin_image || ''; // Fallback empty string
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
      promises.push(new Promise((resolve) => {
        const img = new Image();
        img.src = this.gameSettings.gamebackground_wallpaper || ''; // Fallback empty string
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

  initializePowerUps() {
    this.powerUpEffects = {
      enlargePaddle: (player: "player1" | "player2") => {
        const paddleHeightModifier = 1.5;
        if (player === "player1") this.paddleHeight *= paddleHeightModifier;
        else if (player === "player2") this.paddleHeight *= paddleHeightModifier;
        setTimeout(() => this.paddleHeight /= paddleHeightModifier, 5000);
      },
      shrinkPaddle: (player: "player1" | "player2") => {
        const paddleHeightModifier = 0.5;
        if (player === "player1") this.paddleHeight *= paddleHeightModifier;
        else if (player === "player2") this.paddleHeight *= paddleHeightModifier;
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
      e.preventDefault();
      if (e.code === 'KeyW') this.leftPaddleSpeed = -10;
      if (e.code === 'KeyS') this.leftPaddleSpeed = 10;
      if (e.code === 'ArrowUp') this.rightPaddleSpeed = -10;
      if (e.code === 'ArrowDown') this.rightPaddleSpeed = 10;
    };
    this.onKeyUp = (e: any) => {
      e.preventDefault();
      if (e.code === 'KeyW' || e.code === 'KeyS') this.leftPaddleSpeed = 0;
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') this.rightPaddleSpeed = 0;
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
    shrinkBall: { color: 'brown', icon: '🔽' },  // Downward arrow
    growBall: { color: 'lime', icon: '🔼' },     // Upward arrow
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

  updateScore(player: "player1" | "player2") {
    this.onScore.emit(player);
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
      || this.rightScore >= this.gameSettings.roundScoreLimit)) {
      this.endGame();
    }
  }

  startGame() {
    this.intervalID = window.setInterval(() => this.updateGame(), 1000 / 60);
  }

  resetBall() {
    this.ballX = this.canvasWidth / 2;
    this.ballY = this.canvasHeight / 2;
    this.ballDirectionX = Math.random() < 0.5 ? -1 : 1;
    this.ballDirectionY = (Math.random() * 2 - 1) * 0.5;
    this.ballSpeed = 5;
  }

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
      if (i % 2 === 0)
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
    this.leftPaddleY = Math.min(Math.max(this.paddleHeight / 2, this.leftPaddleY), this.canvasHeight - this.paddleHeight / 2);
    this.rightPaddleY = Math.min(Math.max(this.paddleHeight / 2, this.rightPaddleY), this.canvasHeight - this.paddleHeight / 2);
  }

  checkRoofCollision() {
    if (this.ballY + this.ballDirectionY * this.ballSpeed - this.ballRadius <= 0 || 
        this.ballY + this.ballDirectionY * this.ballSpeed + this.ballRadius >= this.canvasHeight) {
      this.ballDirectionY *= -1;
    }
  }

  checkPaddleCollision() {
    if (this.ballX + this.ballDirectionX * this.ballSpeed - this.ballRadius <= this.paddleWidth) {
      this.paddleCollision(this.ballY - this.leftPaddleY);
    } else if (this.ballX + this.ballDirectionX * this.ballSpeed + this.ballRadius >= this.canvasWidth - this.paddleWidth) {
      this.paddleCollision(this.ballY - this.rightPaddleY);
    }
  }

  paddleCollision(ballPaddleDiff: number) {
    if (Math.abs(ballPaddleDiff) <= this.paddleHeight / 2 + this.ballRadius) {
      this.ballDirectionX *= -1;
      this.lastHit = this.ballDirectionX < 0 ? "player1" : "player2";
      this.ballDirectionY = ballPaddleDiff / (this.paddleHeight / 2);
      if (this.ballSpeed < 100) this.ballSpeed *= 1.05;
    }
  }

  checkScore() {
    if (this.ballX - this.ballRadius < this.paddleWidth) {
      this.rightScore++;
      this.updateScore("player2");
      this.resetBall();
    } else if (this.ballX + this.ballRadius > this.canvasWidth - this.paddleWidth) {
      this.leftScore++;
      this.updateScore("player1");
      this.resetBall();
    }

    if (this.leftScore >= this.gameSettings.roundScoreLimit || this.rightScore >= this.gameSettings.roundScoreLimit) {
      this.resetRound();
    }
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
  
    // Update paddle positions based on their speeds
    this.leftPaddleY += this.leftPaddleSpeed;
    this.rightPaddleY += this.rightPaddleSpeed;
  
    // Ensure paddles stay within bounds
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
    if (this.powerUpsEnabled) window.clearInterval(this.powerUpIntervalID);
    window.clearInterval(this.intervalID);
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: any) {
    e.preventDefault();
    if (e.code === 'KeyW') {
      this.leftPaddleSpeed = -10;
    }
    if (e.code === 'KeyS') {
      this.leftPaddleSpeed = 10;
    }
    if (e.code === 'ArrowUp') {
      this.rightPaddleSpeed = -10;
    }
    if (e.code === 'ArrowDown') {
      this.rightPaddleSpeed = 10;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: any) {
    e.preventDefault();
    if (e.code === 'KeyW') {
      this.leftPaddleSpeed = 0;
    }
    if (e.code === 'KeyS') {
      this.leftPaddleSpeed = 0;
    }
    if (e.code === 'ArrowUp') {
      this.rightPaddleSpeed = 0;
    }
    if (e.code === 'ArrowDown') {
      this.rightPaddleSpeed = 0;
    }
  }
}
