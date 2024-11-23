import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-disclaimer',
  templateUrl: './disclaimer.component.html',
  styleUrls: ['./disclaimer.component.scss']
})
export class DisclaimerComponent {
  constructor(private router: Router) { }

  /**
   * Triggers the browser's print dialog for the Disclaimer page.
   */
  printDisclaimer(): void {
    window.print();
  }
}
