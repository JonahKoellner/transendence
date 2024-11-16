import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
interface ImageSelection {
  type: 'preset' | 'upload';
  data: File | string; // File object for uploads, string identifier/path for presets
}

@Component({
  selector: 'app-image-selector-modal',
  templateUrl: './image-selector-modal.component.html',
  styleUrls: ['./image-selector-modal.component.scss']
})
export class ImageSelectorModalComponent {
  @Input() presetImages: string[] = [];

  constructor(public activeModal: NgbActiveModal) { }

  selectPreset(imagePath: string) {
    const selection: ImageSelection = {
      type: 'preset',
      data: imagePath
    };
    this.activeModal.close(selection);
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      const selection: ImageSelection = {
        type: 'upload',
        data: file
      };
      this.activeModal.close(selection);
    }
  }
}