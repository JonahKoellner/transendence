import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameCanvasComponent } from './game-canvas.component';

describe('GameCanvasComponent', () => {
  let component: GameCanvasComponent;
  let fixture: ComponentFixture<GameCanvasComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameCanvasComponent]
    });
    fixture = TestBed.createComponent(GameCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
