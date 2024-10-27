import { Component, ElementRef, ViewChild, HostListener } from '@angular/core';

@Component({
  selector: 'app-game-canvas',
  templateUrl: './game-canvas.component.html',
  styleUrls: ['./game-canvas.component.scss']
})
export class GameCanvasComponent {
  @ViewChild('GameCanvas', {read: ElementRef, static: false}) canvas!: ElementRef;
  context!: CanvasRenderingContext2D;

  // Game controller data
  readonly canvasWidth = 1000;
  readonly canvasHeight = 500;
  readonly ballRadius = 15;
  readonly paddleWidth = 10;
  readonly paddleHeight = 60;
  readonly dashCount = 41;
  readonly dashWidth = 10;
  readonly scoreToWin = 5;

  gameRunning:        boolean = false;
  startTime!:         Date;
  intervalID!:        number;
  leftScore!:         number;
  rightScore!:        number;
  leftPaddleY!:       number;
  rightPaddleY!:      number;
  leftPaddleSpeed!:   number;
  rightPaddleSpeed!:  number;
  ballX!:             number;
  ballY!:             number;
  ballSpeed!:         number;
  ballDirectionX!:    number;
  ballDirectionY!:    number;

  ngAfterViewInit() {
    this.context = this.canvas.nativeElement.getContext('2d');
  }

  startMatch() {
    this.leftPaddleSpeed = 0;
    this.rightPaddleSpeed = 0;
    this.leftPaddleY = this.canvasHeight / 2;
    this.rightPaddleY = this.canvasHeight / 2;
    this.ballX = this.canvasWidth / 2;
    this.ballY = this.canvasHeight / 2;
    this.ballDirectionX = 1;
    this.ballDirectionY = 0;
    this.ballSpeed = 5;
    this.leftScore = 0;
    this.rightScore = 0;
    this.gameRunning = true;
    this.startTime = new Date();
    this.startGame();
  }

  startGame() {
    this.intervalID = window.setInterval(() => this.updateGame(), 1000 / 60);
  }

  resetBall() {
    this.ballX = this.canvasWidth / 2;
    this.ballY = this.canvasHeight / 2;
    this.ballDirectionX = 1;
    this.ballDirectionY = 0;
    this.ballSpeed = 5;
  }
  drawBackground() {
    this.context.fillStyle = 'black';
    this.context.fillRect(0, 0, 1000, 500);
  }

  drawCenter () {
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

  moveAI() {
    if (this.ballY < this.rightPaddleY - this.paddleHeight / 2)
      this.rightPaddleSpeed = -10;
    else if (this.ballY > this.rightPaddleY + this.paddleHeight / 2)
      this.rightPaddleSpeed = 10;
    else if (this.ballY > this.rightPaddleY - this.paddleHeight / 2 && this.ballY < this.rightPaddleY + this.paddleHeight / 2)
      this.rightPaddleSpeed = 0;
  }

  enforcePaddleBounds() {
    this.leftPaddleY += this.leftPaddleSpeed;
    this.rightPaddleY += this.rightPaddleSpeed;
    if (this.leftPaddleY - this.paddleHeight < 0)
      this.leftPaddleY = this.paddleHeight;
    else if (this.leftPaddleY + this.paddleHeight > this.canvasHeight)
      this.leftPaddleY = this.canvasHeight - this.paddleHeight;
    if (this.rightPaddleY - this.paddleHeight < 0)
      this.rightPaddleY = this.paddleHeight;
    else if (this.rightPaddleY + this.paddleHeight > this.canvasHeight)
      this.rightPaddleY = this.canvasHeight - this.paddleHeight;
  }

  checkRoofCollision()
  {
    if (this.ballY + (this.ballDirectionY * this.ballSpeed) - this.ballRadius <= 0)
      this.ballDirectionY *= -1;
    else if (this.ballY + (this.ballDirectionY * this.ballSpeed) + this.ballRadius >= this.canvasHeight)
      this.ballDirectionY *= -1;
  }

  checkPaddleCollision()
  {
    var diffBallLeftPaddle = this.ballY - this.leftPaddleY;
    var diffBallRightPaddle = this.ballY - this.rightPaddleY;

    if (this.ballX + (this.ballDirectionX * this.ballSpeed) - this.ballRadius <= this.paddleWidth)
      this.paddleCollision(diffBallLeftPaddle);
    else if (this.ballX + (this.ballDirectionX * this.ballSpeed) + this.ballRadius >= this.canvasWidth - this.paddleWidth)
      this.paddleCollision(diffBallRightPaddle);
  }

  paddleCollision(ballPaddleDiff: number) {
    if (ballPaddleDiff > -this.paddleHeight &&ballPaddleDiff < this.paddleHeight){
        this.ballDirectionX *= -1;
        if (ballPaddleDiff < 0)
          {
            if (ballPaddleDiff <= (this.paddleHeight * -1 / 4))
              this.ballDirectionY = -1.1;
            else if (ballPaddleDiff <= (this.paddleHeight * -1 / 4) * 2)
              this.ballDirectionY = -1.3;
            else if (ballPaddleDiff <= (this.paddleHeight * -1 / 4) * 3)
              this.ballDirectionY = -1.6;
            else if (ballPaddleDiff <= this.paddleHeight * -1)
              this.ballDirectionY = -1.9;
          }
        else if (ballPaddleDiff > 0)
          {
            if (ballPaddleDiff <= (this.paddleHeight / 4))
              this.ballDirectionY = 1.1;
            else if (ballPaddleDiff <= (this.paddleHeight / 4) * 2)
              this.ballDirectionY = 1.3;
            else if (ballPaddleDiff <= (this.paddleHeight / 4) * 3)
              this.ballDirectionY = 1.6;
            else if (ballPaddleDiff <= this.paddleHeight)
              this.ballDirectionY = 1.9;
          }
        else
          this.ballDirectionY = 0;
        if (this.ballSpeed < 100)
          this.ballSpeed *= 1.25;
        console.log(this.ballSpeed);
      }
  }

  checkScore() {

    if (this.ballX - this.ballRadius < this.paddleWidth){
      this.rightScore++;
      this.resetBall();
    }
    else if (this.ballX + this.ballRadius > this.canvasWidth - this.paddleWidth){
      this.leftScore++;
      this.resetBall();
    }

    if (this.leftScore == this.scoreToWin || this.rightScore == this.scoreToWin)
      this.endGame();
  }

  updateBallPos() {
    this.ballX += this.ballDirectionX * this.ballSpeed;
    this.ballY += this.ballDirectionY * this.ballSpeed;
  }

  updateGame() {
    this.checkRoofCollision();
    this.checkPaddleCollision();
    this.checkScore();
    this.moveAI();
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
    this.context.fillStyle = 'white';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.gameRunning = false;
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
    if (e.code === 'KeyW') {
      this.leftPaddleSpeed = 0;
    }
    if (e.code === 'KeyS') {
      this.leftPaddleSpeed = 0;
    }
  }
}
