import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameDisplayArenaComponent } from './game-display.component';

describe('GameDisplayArenaComponent', () => {
  let component: GameDisplayArenaComponent;
  let fixture: ComponentFixture<GameDisplayArenaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameDisplayArenaComponent]
    });
    fixture = TestBed.createComponent(GameDisplayArenaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
