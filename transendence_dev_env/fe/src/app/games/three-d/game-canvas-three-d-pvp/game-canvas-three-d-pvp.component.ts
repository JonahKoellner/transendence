import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import * as THREE from 'three';
import { GameSettings } from '../three-d.component';

@Component({
  selector: 'app-game-canvas-three-d-pvp',
  templateUrl: './game-canvas-three-d-pvp.component.html',
  styleUrls: ['./game-canvas-three-d-pvp.component.scss']
})
export class GameCanvasThreeDPvpComponent implements AfterViewInit {
  @ViewChild('rendererContainer', { static: false }) rendererContainer!: ElementRef<HTMLDivElement>;

  @Input() gameSettings!: GameSettings;
  @Output() onScore = new EventEmitter<"player1" | "player2">();

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId = 0;

  private leftPaddle!: THREE.Mesh;
  private rightPaddle!: THREE.Mesh;
  private ball!: THREE.Mesh;
  private wallTop!: THREE.Mesh;
  private wallBottom!: THREE.Mesh;

  readonly fieldWidth = 30;
  readonly fieldHeight = 14;
  private ballSpeed = 0.15;
  private ballDirection = new THREE.Vector2(1, 1);

  private paddleSpeed = 0.2;
  readonly paddleHeight = 3;

  leftScore = 0;
  rightScore = 0;
  round = 0;

  private readonly desiredFPS = 60;
  private readonly msPerFrame = 1000 / this.desiredFPS; // ~16.67 ms
  private lastTimestamp = 0;

  private keysPressed: { [key: string]: boolean } = {};

  constructor() {}

  ngAfterViewInit(): void {
    this.initThree();
    this.initGameObjects();
    this.initEventListeners();
    this.resetRound(); 
    this.animationId = requestAnimationFrame(this.animate);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private initThree(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    const width = 1000;
    const height = 500;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 10;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 10);
    this.scene.add(directionalLight);
  }

  private initGameObjects(): void {
    const paddleGeometry = new THREE.BoxGeometry(1, this.paddleHeight, 0.5);
    const paddleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    this.leftPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.leftPaddle.position.set(-14, 0, 0);
    this.scene.add(this.leftPaddle);

    this.rightPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.rightPaddle.position.set(14, 0, 0);
    this.scene.add(this.rightPaddle);

    const ballGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
    this.ball.position.set(0, 0, 0);
    this.scene.add(this.ball);

    const wallGeometry = new THREE.BoxGeometry(35, 0.5, 1);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    this.wallTop = new THREE.Mesh(wallGeometry, wallMaterial);
    this.wallTop.position.y = 7;
    this.scene.add(this.wallTop);

    this.wallBottom = new THREE.Mesh(wallGeometry, wallMaterial);
    this.wallBottom.position.y = -7;
    this.scene.add(this.wallBottom);

    const dashGeometry = new THREE.BoxGeometry(0.25, 0.5, 0.1);
    for (let i = -6; i <= 6; i++) {
      if (i % 2 === 0) {
        const dash = new THREE.Mesh(dashGeometry, wallMaterial);
        dash.position.y = i;
        dash.position.x = 0;
        this.scene.add(dash);
      }
    }
  }

  private initEventListeners(): void {
    window.addEventListener('keydown', this.onKeyDown, false);
    window.addEventListener('keyup', this.onKeyUp, false);
  }

  @HostListener('window:keydown', ['$event'])
  private onKeyDown = (event: KeyboardEvent): void => {
    this.keysPressed[event.key.toLowerCase()] = true;
  };

  @HostListener('window:keyup', ['$event'])
  private onKeyUp = (event: KeyboardEvent): void => {
    this.keysPressed[event.key.toLowerCase()] = false;
  };

  updateScore(player: "player1" | "player2") {
    this.onScore.emit(player);
  }

  resetRound(): void {
    this.round += 1;
    this.leftScore = 0;
    this.rightScore = 0;
    this.rightPaddle.position.set(14, 0, 0);
    this.leftPaddle.position.set(-14, 0, 0);
    this.resetBall();
  }

  resetBall(): void {
    this.ball.position.set(0, 0, 0);

    const angle = Math.random() * (Math.PI / 4) - Math.PI / 8;
    const direction = Math.random() < 0.5 ? 1 : -1;
    this.ballDirection.set(
      direction * Math.cos(angle),
      Math.sin(angle)
    );
    this.ballSpeed = 0.15;
  }

  private animate = (timestamp: number): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const delta = timestamp - this.lastTimestamp;
    if (delta >= this.msPerFrame) {
      this.lastTimestamp = timestamp - (delta % this.msPerFrame);
      this.updateGame();
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updateGame(): void {
    this.handleInput();
    this.moveBall3D();
    this.checkCollisions3D();
    this.checkScore();
  }

  private handleInput(): void {
    if (this.keysPressed['w']) {
      this.leftPaddle.position.y += this.paddleSpeed;
      if (this.leftPaddle.position.y > 5.5) {
        this.leftPaddle.position.y = 5.5;
      }
    }
    if (this.keysPressed['s']) {
      this.leftPaddle.position.y -= this.paddleSpeed;
      if (this.leftPaddle.position.y < -5.5) {
        this.leftPaddle.position.y = -5.5;
      }
    }
    if (this.keysPressed['arrowup']) {
      this.rightPaddle.position.y += this.paddleSpeed;
      if (this.rightPaddle.position.y > 5.5) {
        this.rightPaddle.position.y = 5.5;
      }
    }
    if (this.keysPressed['arrowdown']) {
      this.rightPaddle.position.y -= this.paddleSpeed;
      if (this.rightPaddle.position.y < -5.5) {
        this.rightPaddle.position.y = -5.5;
      }
    }
  }

  private moveBall3D(): void {
    this.ball.position.x += this.ballDirection.x * this.ballSpeed;
    this.ball.position.y += this.ballDirection.y * this.ballSpeed;
  }

  private checkCollisions3D(): void {
    if (this.ball.position.y >= 6) {
      this.ballDirection.y *= -1;
      this.ball.position.y = 6;
    }
    if (this.ball.position.y <= -6) {
      this.ballDirection.y *= -1;
      this.ball.position.y = -6;
    }

    const ballX = this.ball.position.x;
    const ballY = this.ball.position.y;

    if (ballX - 0.5 <= (this.leftPaddle.position.x + 0.5) &&
      Math.abs(ballY - this.leftPaddle.position.y) <= this.paddleHeight / 2
    ) {
      this.ballDirection.x = Math.abs(this.ballDirection.x);
      this.ball.position.x = this.leftPaddle.position.x + 1;
      if (this.ballSpeed < 1.0) {
        this.ballSpeed += 0.05;
      }
    }

    if (ballX + 0.5 >= (this.rightPaddle.position.x - 0.5) &&
      Math.abs(ballY - this.rightPaddle.position.y) <= this.paddleHeight / 2
    ) {
      this.ballDirection.x = -Math.abs(this.ballDirection.x);
      this.ball.position.x = this.rightPaddle.position.x - 1;
      if (this.ballSpeed < 1.0) {
        this.ballSpeed += 0.05;
      }
    }
  }

  private checkScore(): void {
    if (this.ball.position.x >= 15) {
      this.leftScore++;
      this.updateScore('player1');
      this.resetBall();
    }
    if (this.ball.position.x <= -15) {
      
      this.rightScore++;
      this.updateScore('player2');
      this.resetBall();
    }

    if (this.leftScore >= this.gameSettings.roundScoreLimit ||
      this.rightScore >= this.gameSettings.roundScoreLimit)
      this.resetRound();
  }
}