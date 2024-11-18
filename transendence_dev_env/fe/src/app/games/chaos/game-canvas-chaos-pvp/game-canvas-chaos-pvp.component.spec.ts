import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameCanvasChaosPvpComponent } from './game-canvas-chaos-pvp.component';

describe('GameCanvasChaosPvpComponent', () => {
  let component: GameCanvasChaosPvpComponent;
  let fixture: ComponentFixture<GameCanvasChaosPvpComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameCanvasChaosPvpComponent]
    });
    fixture = TestBed.createComponent(GameCanvasChaosPvpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
