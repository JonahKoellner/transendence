import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  HostListener,
  OnDestroy
} from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-local3d-pvp',
  templateUrl: './local-pvp.component.html',
  styleUrls: ['./local-pvp.component.scss']
})
export class Local3dPvpComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef;

  // THREE.js essentials
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  // Game objects
  private leftPaddle!: THREE.Mesh;
  private rightPaddle!: THREE.Mesh;
  private ball!: THREE.Mesh;
  private wallTop!: THREE.Mesh;
  private wallBottom!: THREE.Mesh;

  // Game parameters
  private paddleSpeed: number = 0.2;
  private ballSpeed: number = 0.15;
  private ballDirection: THREE.Vector2 = new THREE.Vector2(1, 1);
  private leftScore: number = 0;
  private rightScore: number = 0;

  // Input states
  private keysPressed: { [key: string]: boolean } = {};

  // Animation
  private animationId: number = 0;

  constructor() {}

  ngOnInit(): void {
    // Start the game when the component initializes
    // Actual initialization occurs in ngAfterViewInit
  }

  ngAfterViewInit(): void {
    this.initThree();
    this.initGameObjects();
    this.initEventListeners();
    this.startFullscreen();
    this.animate();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onWindowResize);
  }

  private initThree(): void {
    // Create the scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Create the camera
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 10;

    // Create the renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 10);
    this.scene.add(directionalLight);
  }

  private initGameObjects(): void {
    // Create paddles
    const paddleGeometry = new THREE.BoxGeometry(1, 3, 0.5);
    const paddleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

    this.leftPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.leftPaddle.position.x = -8;
    this.scene.add(this.leftPaddle);

    this.rightPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.rightPaddle.position.x = 8;
    this.scene.add(this.rightPaddle);

    // Create ball
    const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
    this.ball.position.set(0, 0, 0);
    this.scene.add(this.ball);

    // Create walls
    const wallGeometry = new THREE.BoxGeometry(20, 0.5, 1);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

    this.wallTop = new THREE.Mesh(wallGeometry, wallMaterial);
    this.wallTop.position.y = 7;
    this.scene.add(this.wallTop);

    this.wallBottom = new THREE.Mesh(wallGeometry, wallMaterial);
    this.wallBottom.position.y = -7;
    this.scene.add(this.wallBottom);
  }

  private initEventListeners(): void {
    window.addEventListener('keydown', this.onKeyDown, false);
    window.addEventListener('keyup', this.onKeyUp, false);
    window.addEventListener('resize', this.onWindowResize, false);
  }

  @HostListener('window:keydown', ['$event'])
  private onKeyDown = (event: KeyboardEvent): void => {
    this.keysPressed[event.key.toLowerCase()] = true;
  };

  @HostListener('window:keyup', ['$event'])
  private onKeyUp = (event: KeyboardEvent): void => {
    this.keysPressed[event.key.toLowerCase()] = false;
  };

  @HostListener('window:resize', ['$event'])
  private onWindowResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private startFullscreen(): void {
    if (this.renderer.domElement.requestFullscreen) {
      this.renderer.domElement.requestFullscreen();
    } else if (this.renderer.domElement.requestFullscreen) { /* Safari */
      this.renderer.domElement.requestFullscreen();
    } else if (this.renderer.domElement.requestFullscreen) { /* IE11 */
      this.renderer.domElement.requestFullscreen();
    }
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.updateGame();
    this.renderer.render(this.scene, this.camera);
  };

  private updateGame(): void {
    this.handleInput();
    this.moveBall();
    this.checkCollisions();
  }

  private handleInput(): void {
    // Left paddle controls: 'w' and 's'
    if (this.keysPressed['w']) {
      this.leftPaddle.position.y += this.paddleSpeed;
      if (this.leftPaddle.position.y > 6) this.leftPaddle.position.y = 6;
    }
    if (this.keysPressed['s']) {
      this.leftPaddle.position.y -= this.paddleSpeed;
      if (this.leftPaddle.position.y < -6) this.leftPaddle.position.y = -6;
    }

    // Right paddle controls: 'arrowup' and 'arrowdown'
    if (this.keysPressed['arrowup']) {
      this.rightPaddle.position.y += this.paddleSpeed;
      if (this.rightPaddle.position.y > 6) this.rightPaddle.position.y = 6;
    }
    if (this.keysPressed['arrowdown']) {
      this.rightPaddle.position.y -= this.paddleSpeed;
      if (this.rightPaddle.position.y < -6) this.rightPaddle.position.y = -6;
    }
  }

  private moveBall(): void {
    this.ball.position.x += this.ballDirection.x * this.ballSpeed;
    this.ball.position.y += this.ballDirection.y * this.ballSpeed;
  }

  private checkCollisions(): void {
    // Top and Bottom walls
    if (this.ball.position.y >= 6.75) {
      this.ballDirection.y = -1;
    }
    if (this.ball.position.y <= -6.75) {
      this.ballDirection.y = 1;
    }

    // Left and Right walls (Scoring)
    if (this.ball.position.x >= 9) {
      this.leftScore += 1;
      this.resetBall();
    }
    if (this.ball.position.x <= -9) {
      this.rightScore += 1;
      this.resetBall();
    }

    // Paddles collision
    const paddleCollisionThreshold = 0.5;
    // Left Paddle
    if (
      this.ball.position.x - 0.5 <= this.leftPaddle.position.x + 0.5 &&
      Math.abs(this.ball.position.y - this.leftPaddle.position.y) <= 1.5
    ) {
      this.ballDirection.x = 1;
    }

    // Right Paddle
    if (
      this.ball.position.x + 0.5 >= this.rightPaddle.position.x - 0.5 &&
      Math.abs(this.ball.position.y - this.rightPaddle.position.y) <= 1.5
    ) {
      this.ballDirection.x = -1;
    }
  }

  private resetBall(): void {
    this.ball.position.set(0, 0, 0);
    // Randomize initial direction
    const angle = Math.random() * Math.PI / 4 - Math.PI / 8; // Between -22.5 to 22.5 degrees
    const direction = Math.random() < 0.5 ? 1 : -1;
    this.ballDirection.set(
      direction * Math.cos(angle),
      Math.sin(angle)
    );
  }

  // Utility to get the current score as a string
  get score(): string {
    return `${this.leftScore} : ${this.rightScore}`;
  }
}
