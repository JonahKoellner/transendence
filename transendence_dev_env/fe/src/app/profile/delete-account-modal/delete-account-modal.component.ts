// delete-account-modal.component.ts

import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-delete-account-modal',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">Confirm Account Deletion</h4>
      <button type="button" class="close" aria-label="Close" (click)="activeModal.dismiss('cancel')">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to delete your account? This action cannot be undone.</p>
      <form (ngSubmit)="confirmDeletion()" #deleteForm="ngForm">
        <div class="form-group">
          <label for="password">Enter your password to confirm:</label>
          <input type="password" id="password" name="password" class="form-control" [(ngModel)]="password" required />
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss('cancel')">Cancel</button>
      <button type="button" class="btn btn-danger" [disabled]="!password" (click)="confirmDeletion()">Delete</button>
    </div>
  `,
})
export class DeleteAccountModalComponent {
  password: string = '';

  constructor(public activeModal: NgbActiveModal) {}

  confirmDeletion() {
    if (this.password.trim() === '') {
      alert('Please enter your password to confirm.');
      return;
    }
    this.activeModal.close(this.password);
  }
}
