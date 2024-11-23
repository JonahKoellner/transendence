import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {
  pdfSrc: string = 'assets/subject.pdf';
  konamiCode: string[] = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];
  konamiIndex: number = 0;

  // Reference to the event handler for removal
  private keyDownHandler!: (e: KeyboardEvent) => void;

  // Controls the visibility of the retro game modal
  showRetroGameModal: boolean = false;

  // Safe URL for the retro game iframe
  retroGameUrl!: SafeResourceUrl;

  constructor(public sanitizer: DomSanitizer) { }

  ngOnInit() {
    this.loadKonamiCode();
  }

  ngOnDestroy() {
    // Remove the event listener when the component is destroyed to prevent memory leaks
    document.removeEventListener('keydown', this.keyDownHandler);
  }

  loadKonamiCode() {
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === this.konamiCode[this.konamiIndex]) {
        this.konamiIndex++;
        if (this.konamiIndex === this.konamiCode.length) {
          this.activateEasterEgg();
          this.konamiIndex = 0;
        }
      } else {
        this.konamiIndex = 0;
      }
    };

    document.addEventListener('keydown', this.keyDownHandler);
  }

  activateEasterEgg() {
    // Display a playful alert
    alert("🎉 Konami Code Activated! Enjoy the retro game! 🎮");

    // Set the retro game URL (you can choose any embeddable retro game)
    // Example: Classic Snake game
    this.retroGameUrl = this.sanitizer.bypassSecurityTrustResourceUrl('https://codepen.io/GeekyAnts/embed/wvrMRo?default-tab=result');

    // Show the retro game modal
    this.showRetroGameModal = true;
  }

  closeRetroGameModal() {
    this.showRetroGameModal = false;
  }
}
