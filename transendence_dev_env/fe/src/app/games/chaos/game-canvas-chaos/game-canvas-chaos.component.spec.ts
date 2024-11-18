import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameCanvasChaosComponent } from './game-canvas-chaos.component';

describe('GameCanvasChaosComponent', () => {
  let component: GameCanvasChaosComponent;
  let fixture: ComponentFixture<GameCanvasChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameCanvasChaosComponent]
    });
    fixture = TestBed.createComponent(GameCanvasChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
