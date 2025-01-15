import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameCanvasThreeDPveComponent } from './game-canvas-three-d-pve.component';

describe('GameCanvasThreeDPveComponent', () => {
  let component: GameCanvasThreeDPveComponent;
  let fixture: ComponentFixture<GameCanvasThreeDPveComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameCanvasThreeDPveComponent]
    });
    fixture = TestBed.createComponent(GameCanvasThreeDPveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
