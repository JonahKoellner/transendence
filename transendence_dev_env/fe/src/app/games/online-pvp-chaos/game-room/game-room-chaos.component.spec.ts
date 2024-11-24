import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoomChaosComponent } from './game-room-chaos.component';

describe('GameRoomChaosComponent', () => {
  let component: GameRoomChaosComponent;
  let fixture: ComponentFixture<GameRoomChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameRoomChaosComponent]
    });
    fixture = TestBed.createComponent(GameRoomChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
