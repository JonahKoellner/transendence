import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PvpGameCanvasComponent } from './pvp-game-canvas.component';

describe('PvpGameCanvasComponent', () => {
  let component: PvpGameCanvasComponent;
  let fixture: ComponentFixture<PvpGameCanvasComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PvpGameCanvasComponent]
    });
    fixture = TestBed.createComponent(PvpGameCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
