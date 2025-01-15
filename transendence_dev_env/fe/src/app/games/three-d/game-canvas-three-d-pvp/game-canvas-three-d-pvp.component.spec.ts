import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameCanvasThreeDPvpComponent } from './game-canvas-three-d-pvp.component';

describe('GameCanvasThreeDPvpComponent', () => {
  let component: GameCanvasThreeDPvpComponent;
  let fixture: ComponentFixture<GameCanvasThreeDPvpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameCanvasThreeDPvpComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(GameCanvasThreeDPvpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
