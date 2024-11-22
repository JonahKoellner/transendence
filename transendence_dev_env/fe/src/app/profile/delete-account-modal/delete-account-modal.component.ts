// delete-account-modal.component.ts

import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-delete-account-modal',
  templateUrl: './delete-account-modal.component.html',
  styleUrls: ['./delete-account-modal.component.scss']
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
