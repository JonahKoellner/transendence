import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PveGameCanvasComponent } from './pve-game-canvas.component';

describe('PveGameCanvasComponent', () => {
  let component: PveGameCanvasComponent;
  let fixture: ComponentFixture<PveGameCanvasComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PveGameCanvasComponent]
    });
    fixture = TestBed.createComponent(PveGameCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
