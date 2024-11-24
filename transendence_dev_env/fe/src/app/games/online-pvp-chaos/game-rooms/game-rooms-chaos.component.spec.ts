import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoomsChaosComponent } from './game-rooms-chaos.component';

describe('GameRoomsChaosComponent', () => {
  let component: GameRoomsChaosComponent;
  let fixture: ComponentFixture<GameRoomsChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameRoomsChaosComponent]
    });
    fixture = TestBed.createComponent(GameRoomsChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
