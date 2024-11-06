import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';

@Component({
  selector: 'app-game-display',
  templateUrl: './game-display.component.html',
  styleUrls: ['./game-display.component.scss']
})
export class GameDisplayComponent implements AfterViewInit, OnChanges {
  @Input() gameState: any;
  @ViewChild('gameCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  context!: CanvasRenderingContext2D;

  ngAfterViewInit() {
    const context = this.canvas.nativeElement.getContext('2d');
    if (context) {
      this.context = context;
      this.drawGame();
    }
    this.drawGame();
  }

  ngOnChanges() {
    if (this.context) {
      this.drawGame();
    }
  }

  drawGame() {
    this.context.clearRect(0, 0, 1000, 500);
    this.drawBall(this.gameState.ball_x, this.gameState.ball_y);
    this.drawPaddle(0, this.gameState.left_paddle_y);
    this.drawPaddle(990, this.gameState.right_paddle_y);
  }

  drawBall(x: number, y: number) {
    this.context.beginPath();
    this.context.arc(x, y, 15, 0, 2 * Math.PI);
    this.context.fillStyle = 'white';
    this.context.fill();
  }

  drawPaddle(x: number, y: number) {
    this.context.fillStyle = 'white';
    this.context.fillRect(x, y, 10, 60);
  }
}