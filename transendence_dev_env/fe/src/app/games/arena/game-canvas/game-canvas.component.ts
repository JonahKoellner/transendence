import { Component, ElementRef, ViewChild, HostListener, Output, EventEmitter, Input, AfterViewInit, OnInit } from '@angular/core';
import { GameSettings } from '../arena.component';

@Component({
  selector: 'app-game-arena',
  templateUrl: './game-canvas.component.html',
  styleUrls: ['./game-canvas.component.scss']
})
export class GameCanvasComponentArena implements AfterViewInit, OnInit {
  @ViewChild('GameCanvas', { read: ElementRef, static: false }) canvas!: ElementRef;
  context!: CanvasRenderingContext2D;

  @Input() settings!: GameSettings;
  @Output() onScore = new EventEmitter<'player1' | 'player2' | 'player3' | 'player4'>();

  // Game properties
  readonly canvasSize = 800; // Square canvas size
  readonly ballRadius = 10;
  readonly paddleThickness = 10;
  readonly paddleLength = 80;

  // Paddles' positions
  leftPaddleY!: number;
  rightPaddleY!: number;
  topPaddleX!: number;
  bottomPaddleX!: number;

  // Paddles' speeds
  leftPaddleSpeed = 0;
  rightPaddleSpeed = 0;
  topPaddleSpeed = 0;
  bottomPaddleSpeed = 0;

  // Ball properties
  ballX!: number;
  ballY!: number;
  ballSpeedX!: number;
  ballSpeedY!: number;
  ballSpeed!: number;

  // Scores
  scores = {
    player1: 0,
    player2: 0,
    player3: 0,
    player4: 0
  };

  intervalID!: number;

  ngOnInit() {
    document.addEventListener('pointerlockchange', () => {
      console.log('')
    });
  }

  ngAfterViewInit() {
    if (!this.canvas) {
      // console.error('Canvas is not initialized!');
      return;
    }
    this.context = this.canvas.nativeElement.getContext('2d')!;
    this.resetGame(); // Initialize game
    this.startGame(); // Start game loop
  }

  resetGame() {
    // Initialize paddle positions
    this.leftPaddleY = this.canvasSize / 2 - this.paddleLength / 2;
    this.rightPaddleY = this.canvasSize / 2 - this.paddleLength / 2;
    this.topPaddleX = this.canvasSize / 2 - this.paddleLength / 2;
    this.bottomPaddleX = this.canvasSize / 2 - this.paddleLength / 2;

    // Reset ball position and speed
    this.ballX = this.canvasSize / 2;
    this.ballY = this.canvasSize / 2;
    this.ballSpeedX = Math.random() < 0.5 ? -5 : 5;
    this.ballSpeedY = Math.random() < 0.5 ? -5 : 5;
    this.ballSpeed = 5;

    // Reset scores
    this.scores = {
      player1: 0,
      player2: 0,
      player3: 0,
      player4: 0
    };
  }

  startGame() {
    this.intervalID = window.setInterval(() => this.updateGame(), 1000 / 60);
  }

  updateGame() {
    // Update paddle positions
    this.leftPaddleY += this.leftPaddleSpeed;
    this.rightPaddleY += this.rightPaddleSpeed;
    this.topPaddleX += this.topPaddleSpeed;
    this.bottomPaddleX += this.bottomPaddleSpeed;

    // Enforce paddle boundaries
    this.enforcePaddleBounds();

    // Update ball position
    this.ballX += this.ballSpeedX;
    this.ballY += this.ballSpeedY;

    // Check collisions
    this.checkCollisions();

    // Draw the game
    this.drawGame();
  }

  enforcePaddleBounds() {
    // Keep paddles within bounds
    this.leftPaddleY = Math.max(Math.min(this.leftPaddleY, this.canvasSize - this.paddleLength), 0);
    this.rightPaddleY = Math.max(Math.min(this.rightPaddleY, this.canvasSize - this.paddleLength), 0);
    this.topPaddleX = Math.max(Math.min(this.topPaddleX, this.canvasSize - this.paddleLength), 0);
    this.bottomPaddleX = Math.max(Math.min(this.bottomPaddleX, this.canvasSize - this.paddleLength), 0);
  }

  checkCollisions() {
    // Ball collision with left paddle
    if (this.ballX - this.ballRadius <= this.paddleThickness) {
      if (this.ballY >= this.leftPaddleY && this.ballY <= this.leftPaddleY + this.paddleLength) {
        this.ballSpeedX *= -1;
      } else {
        this.scores.player1++;
        this.onScore.emit('player1');
        this.resetBall();
      }
    }

    // Ball collision with right paddle
    if (this.ballX + this.ballRadius >= this.canvasSize - this.paddleThickness) {
      if (this.ballY >= this.rightPaddleY && this.ballY <= this.rightPaddleY + this.paddleLength) {
        this.ballSpeedX *= -1;
      } else {
        this.scores.player2++;
        this.onScore.emit('player2');
        this.resetBall();
      }
    }

    // Ball collision with top paddle
    if (this.ballY - this.ballRadius <= this.paddleThickness) {
      if (this.ballX >= this.topPaddleX && this.ballX <= this.topPaddleX + this.paddleLength) {
        this.ballSpeedY *= -1;
      } else {
        this.scores.player4++;
        this.onScore.emit('player4');
        this.resetBall();
      }
    }

    // Ball collision with bottom paddle
    if (this.ballY + this.ballRadius >= this.canvasSize - this.paddleThickness) {
      if (this.ballX >= this.bottomPaddleX && this.ballX <= this.bottomPaddleX + this.paddleLength) {
        this.ballSpeedY *= -1;
      } else {
        this.scores.player3++;
        this.onScore.emit('player3');
        this.resetBall();
      }
    }
  }

  resetBall() {
    this.ballX = this.canvasSize / 2;
    this.ballY = this.canvasSize / 2;
  
    // Generate a random angle in radians (0 to 2π for full 360 degrees)
    const randomAngle = Math.random() * 2 * Math.PI;
  
    // Calculate the x and y components of the velocity using the random angle
    this.ballSpeedX = this.ballSpeed * Math.cos(randomAngle);
    this.ballSpeedY = this.ballSpeed * Math.sin(randomAngle);
  
    // Ensure the ball moves at the set speed
    const speed = Math.sqrt(this.ballSpeedX ** 2 + this.ballSpeedY ** 2);
    this.ballSpeedX = (this.ballSpeedX / speed) * this.ballSpeed;
    this.ballSpeedY = (this.ballSpeedY / speed) * this.ballSpeed;
  }

  drawGame() {
    // Clear canvas
    this.context.clearRect(0, 0, this.canvasSize, this.canvasSize);

    // Draw background
    this.context.fillStyle = 'black';
    this.context.fillRect(0, 0, this.canvasSize, this.canvasSize);

    // Draw paddles
    this.context.fillStyle = 'white';
    this.context.fillRect(0, this.leftPaddleY, this.paddleThickness, this.paddleLength); // Left paddle
    this.context.fillRect(this.canvasSize - this.paddleThickness, this.rightPaddleY, this.paddleThickness, this.paddleLength); // Right paddle
    this.context.fillRect(this.topPaddleX, 0, this.paddleLength, this.paddleThickness); // Top paddle
    this.context.fillRect(this.bottomPaddleX, this.canvasSize - this.paddleThickness, this.paddleLength, this.paddleThickness); // Bottom paddle

    // Draw ball
    this.context.beginPath();
    this.context.arc(this.ballX, this.ballY, this.ballRadius, 0, Math.PI * 2);
    this.context.fill();

    // Draw scores
    this.context.font = '20px Arial';
    this.context.fillStyle = 'white';
    this.context.fillText(`P1: ${this.scores.player1}`, 20, 30);
    this.context.fillText(`P2: ${this.scores.player2}`, this.canvasSize - 80, 30);
    this.context.fillText(`P4: ${this.scores.player4}`, this.canvasSize / 2 - 30, 30);
    this.context.fillText(`P3: ${this.scores.player3}`, this.canvasSize / 2 - 30, this.canvasSize - 10);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    if (e.key === 'w' || e.key === 'W') this.leftPaddleSpeed = -10; // Player 1
    if (e.key === 's' || e.key === 'S') this.leftPaddleSpeed = 10;  // Player 1
    if (e.key === 'ArrowUp') this.rightPaddleSpeed = -10;           // Player 2
    if (e.key === 'ArrowDown') this.rightPaddleSpeed = 10;          // Player 2
    if (e.key === 'n' || e.key === 'N') this.bottomPaddleSpeed = -10; // Player 3
    if (e.key === 'm' || e.key === 'M') this.bottomPaddleSpeed = 10;  // Player 3
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) {
    e.preventDefault();
    if (e.key === 'w' || e.key === 'W') this.leftPaddleSpeed = 0;  // Player 1
    if (e.key === 's' || e.key === 'S') this.leftPaddleSpeed = 0;  // Player 1
    if (e.key === 'ArrowUp') this.rightPaddleSpeed = 0;            // Player 2
    if (e.key === 'ArrowDown') this.rightPaddleSpeed = 0;          // Player 2
    if (e.key === 'n' || e.key === 'N') this.bottomPaddleSpeed = 0; // Player 3
    if (e.key === 'm' || e.key === 'M') this.bottomPaddleSpeed = 0; // Player 3
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!document.pointerLockElement) return;

    const maxSpeed = 10; // Maximum paddle speed
    let deltaX = event.movementX;

    deltaX = Math.max(Math.min(deltaX, maxSpeed), -maxSpeed);
    this.topPaddleX += deltaX;
    this.topPaddleX = Math.max(Math.min(this.topPaddleX, this.canvasSize - this.paddleLength), 0);
  }

  @HostListener('click', ['$event'])
  onCanvasClick(event: MouseEvent) {
    if (this.canvas && this.canvas.nativeElement) {
      this.canvas.nativeElement.requestPointerLock();
    }
  }
}
