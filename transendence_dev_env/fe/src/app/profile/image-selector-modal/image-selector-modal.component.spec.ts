import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageSelectorModalComponent } from './image-selector-modal.component';

describe('ImageSelectorModalComponent', () => {
  let component: ImageSelectorModalComponent;
  let fixture: ComponentFixture<ImageSelectorModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ImageSelectorModalComponent]
    });
    fixture = TestBed.createComponent(ImageSelectorModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
