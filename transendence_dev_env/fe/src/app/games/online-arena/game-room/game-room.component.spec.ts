import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoomArenaComponent } from './game-room.component';

describe('GameRoomArenaComponent', () => {
  let component: GameRoomArenaComponent;
  let fixture: ComponentFixture<GameRoomArenaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameRoomArenaComponent]
    });
    fixture = TestBed.createComponent(GameRoomArenaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
