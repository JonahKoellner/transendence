import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoomsComponent } from './game-rooms.component';

describe('GameRoomsComponent', () => {
  let component: GameRoomsComponent;
  let fixture: ComponentFixture<GameRoomsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameRoomsComponent]
    });
    fixture = TestBed.createComponent(GameRoomsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
