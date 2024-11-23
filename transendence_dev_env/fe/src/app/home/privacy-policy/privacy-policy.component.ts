import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CookieConsentService } from 'src/app/services/cookie-consent.service';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent {
  constructor(private router: Router, private cookieService: CookieConsentService) { }

  printPolicy(): void {
    window.print();
  }
  removeConsent(): void {
    this.cookieService.removeConsent();
    location.reload();
  }
}
