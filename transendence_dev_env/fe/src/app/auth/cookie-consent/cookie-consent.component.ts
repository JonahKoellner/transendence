import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CookieConsentService } from 'src/app/services/cookie-consent.service';

@Component({
  selector: 'app-cookie-consent',
  templateUrl: './cookie-consent.component.html',
  styleUrls: ['./cookie-consent.component.scss']
})
export class CookieConsentComponent {
  showBanner: boolean = false;

  constructor(private consentService: CookieConsentService, private router: Router) { }

  ngOnInit(): void {
    const consent = this.consentService.getConsent();
    if (consent === null) {
      // Show banner if no consent decision has been made
      this.showBanner = true;
    }
  }

  acceptCookies(): void {
    this.consentService.setConsent(true);
    this.showBanner = false;
    // Initialize non-essential services here if any
  }

  declineCookies(): void {
    this.consentService.setConsent(false);
    this.showBanner = false;
    // Disable or prevent non-essential services here if any
  }

  openPrivacyPolicy(): void {
    this.router.navigate(['/privacy-policy']);
  }
}