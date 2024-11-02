import { Component, ElementRef, ViewChild, HostListener, Output, EventEmitter } from '@angular/core';


@Component({
  selector: 'app-pvp-game-canvas',
  templateUrl: './pvp-game-canvas.component.html',
  styleUrls: ['./pvp-game-canvas.component.scss']
})
export class PvpGameCanvasComponent {
  @ViewChild('GameCanvasPVP', {read: ElementRef, static: false}) canvas!: ElementRef;
  context!: CanvasRenderingContext2D;
  @Output() onReady = new EventEmitter<void>();
  @Output() onScore = new EventEmitter<"player1" | "player2">();
  @Output() onGameEnd = new EventEmitter<void>();
  readonly canvasWidth = 1000;
  readonly canvasHeight = 500;
  readonly ballRadius = 15;
  readonly paddleWidth = 10;
  readonly paddleHeight = 60;
  readonly dashCount = 41;
  readonly dashWidth = 10;

  intervalID!: number;
  gameTimerID!: number;
  timeLeft: number = 90;

  leftPaddleSpeed: number = 0;
  rightPaddleSpeed: number = 0;
  leftPaddleY!: number;
  rightPaddleY!: number;
  ballX!: number;
  ballY!: number;
  ballDirectionX: number = 1;
  ballDirectionY: number = 0;
  ballSpeed: number = 5;
  leftScore: number = 0;
  rightScore: number = 0;
  private gamePaused: boolean = false;
  ngAfterViewInit() {
    this.context = this.canvas.nativeElement.getContext('2d');
    this.resetRound();
    this.onReady.emit();
    this.startGame();
  }

  resetRound() {
    this.leftPaddleY = this.canvasHeight / 2;
    this.rightPaddleY = this.canvasHeight / 2;
    this.resetBall();
    this.leftScore = 0;
    this.rightScore = 0;
  }

  startGame() {
    this.resume();
  }
  updateTime() {
    if (this.timeLeft > 0) {
      this.timeLeft--;
    } else {
      this.endGame(); // End game only when timer expires
    }
  }

  resetBall() {
    this.ballX = this.canvasWidth / 2;
    this.ballY = this.canvasHeight / 2;
    this.ballDirectionX = Math.random() < 0.5 ? -1 : 1;
    this.ballDirectionY = (Math.random() * 2 - 1) * 0.5; // Random direction to avoid straight line
    this.ballSpeed = 5;
  }

  drawBackground() {
    this.context.fillStyle = 'black';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
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
    this.context.fillText(`Time: ${this.timeLeft}s`, this.canvasWidth / 2 - 50, 30);
  }

  drawBall(x: number, y: number) {
    this.context.fillStyle = 'white';
    this.context.beginPath();
    this.context.arc(x, y, this.ballRadius, 0, 2 * Math.PI);
    this.context.closePath();
    this.context.fill();
  }

  drawPaddle(x: number, y: number) {
    this.context.fillStyle = 'white';
    this.context.fillRect(x, y, this.paddleWidth, -this.paddleHeight);
    this.context.fillRect(x, y, this.paddleWidth, this.paddleHeight);
  }

  enforcePaddleBounds() {
    this.leftPaddleY += this.leftPaddleSpeed;
    this.rightPaddleY += this.rightPaddleSpeed;
    if (this.leftPaddleY - this.paddleHeight < 0) this.leftPaddleY = this.paddleHeight;
    else if (this.leftPaddleY + this.paddleHeight > this.canvasHeight)
      this.leftPaddleY = this.canvasHeight - this.paddleHeight;
    if (this.rightPaddleY - this.paddleHeight < 0) this.rightPaddleY = this.paddleHeight;
    else if (this.rightPaddleY + this.paddleHeight > this.canvasHeight)
      this.rightPaddleY = this.canvasHeight - this.paddleHeight;
  }

  checkRoofCollision() {
    if (this.ballY + (this.ballDirectionY * this.ballSpeed) - this.ballRadius <= 0 ||
      this.ballY + (this.ballDirectionY * this.ballSpeed) + this.ballRadius >= this.canvasHeight) {
      this.ballDirectionY *= -1;
    }
  }

  checkPaddleCollision() {
    const diffBallLeftPaddle = this.ballY - this.leftPaddleY;
    const diffBallRightPaddle = this.ballY - this.rightPaddleY;

    if (this.ballX + (this.ballDirectionX * this.ballSpeed) - this.ballRadius <= this.paddleWidth)
      this.paddleCollision(diffBallLeftPaddle);
    else if (this.ballX + (this.ballDirectionX * this.ballSpeed) + this.ballRadius >= this.canvasWidth - this.paddleWidth)
      this.paddleCollision(diffBallRightPaddle);
  }

  paddleCollision(ballPaddleDiff: number) {
    if (ballPaddleDiff > -this.paddleHeight - this.ballRadius && ballPaddleDiff < this.paddleHeight + this.ballRadius) {
      this.ballDirectionX *= -1;
      this.ballDirectionY = ballPaddleDiff / this.paddleHeight;
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
  }

  updateScore(player: "player1" | "player2") {
    this.onScore.emit(player);
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
    this.enforcePaddleBounds();
    this.drawBackground();
    this.drawCenter();
    this.drawScore();
    this.drawBall(this.ballX, this.ballY);
    this.drawPaddle(0, this.leftPaddleY);
    this.drawPaddle(this.canvasWidth - this.paddleWidth, this.rightPaddleY);
  }

  endGame() {
    window.clearInterval(this.intervalID);
    window.clearInterval(this.gameTimerID);
    this.onGameEnd.emit(); // Emit event to signal end of game after 90 seconds
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.context.fillStyle = 'black';
    this.context.font = '40px Sans-serif';
    this.context.fillText("Game Over", this.canvasWidth / 2 - 100, this.canvasHeight / 2);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: any) {
    if (e.code === 'KeyW') this.leftPaddleSpeed = -10;
    if (e.code === 'KeyS') this.leftPaddleSpeed = 10;
    if (e.code === 'ArrowUp') this.rightPaddleSpeed = -10;
    if (e.code === 'ArrowDown') this.rightPaddleSpeed = 10;
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: any) {
    if (e.code === 'KeyW' || e.code === 'KeyS') this.leftPaddleSpeed = 0;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') this.rightPaddleSpeed = 0;
  }
  pause() {
    // Clear both intervals to fully pause the game
    if (this.intervalID) {
      clearInterval(this.intervalID);
      this.intervalID = 0;
    }
    if (this.gameTimerID) {
      clearInterval(this.gameTimerID);
      this.gameTimerID = 0;
    }
  }
  
  resume() {
    // Restart intervals only if they aren't already running
    if (!this.intervalID) {
      this.intervalID = window.setInterval(() => this.updateGame(), 1000 / 60);
    }
    if (!this.gameTimerID) {
      this.gameTimerID = window.setInterval(() => this.updateTime(), 1000);
    }
  }
}