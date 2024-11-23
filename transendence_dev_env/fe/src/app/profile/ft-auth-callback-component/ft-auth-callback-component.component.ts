// src/app/ft-auth-callback-component/ft-auth-callback-component.component.ts

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FtAuthService } from 'src/app/ft-auth.service';

@Component({
  selector: 'app-ft-auth-callback-component',
  templateUrl: './ft-auth-callback-component.component.html',
  styleUrls: ['./ft-auth-callback-component.component.scss']
})
export class FtAuthCallbackComponentComponent implements OnInit {

  constructor(private ftAuthService: FtAuthService, private router: Router) { }

  ngOnInit(): void {
    this.ftAuthService.handleAuthCallback().subscribe({
      next: () => {
        // Authentication successful, navigate to profile
        this.router.navigate(['/profile'], { queryParams: { ftAuthError: false } });
      },
      error: (err) => {
        console.error('Authentication failed', err);
        // Optionally, display an error message or navigate to an error page
        this.router.navigate(['/profile'], { queryParams: { ftAuthError: true } });
      }
    });
  }
}
