import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CookieConsentService {
  private consentKey = 'userCookieConsent';

  constructor() { }

  // Set consent status
  setConsent(consent: boolean) {
    localStorage.setItem(this.consentKey, JSON.stringify(consent));
  }

  // Get consent status
  getConsent(): boolean {
    const consent = localStorage.getItem(this.consentKey);
    return consent ? JSON.parse(consent) : null;
  }

  // Remove consent (if needed)
  removeConsent() {
    localStorage.removeItem(this.consentKey);
  }
}