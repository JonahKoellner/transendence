import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html',
  styleUrls: ['./terms-of-service.component.scss']
})
export class TermsOfServiceComponent {

  constructor(private router: Router) { }
  /**
   * Triggers the browser's print dialog for the Terms of Service page.
   */
  printTerms(): void {
    window.print();
  }
}
