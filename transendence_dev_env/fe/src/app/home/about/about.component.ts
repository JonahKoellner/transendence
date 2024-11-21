import { Component } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {
  pdfSrc: string = 'assets/subject.pdf';

  constructor(public sanitizer: DomSanitizer) { }

}
