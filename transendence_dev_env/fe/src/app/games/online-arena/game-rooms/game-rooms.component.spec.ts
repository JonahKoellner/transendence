import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoomsArenaComponent } from './game-rooms.component';

describe('GameRoomsArenaComponent', () => {
  let component: GameRoomsArenaComponent;
  let fixture: ComponentFixture<GameRoomsArenaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameRoomsArenaComponent]
    });
    fixture = TestBed.createComponent(GameRoomsArenaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
