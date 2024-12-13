import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JoinRoomArenaComponent } from './join-room.component';

describe('JoinRoomArenaComponent', () => {
  let component: JoinRoomArenaComponent;
  let fixture: ComponentFixture<JoinRoomArenaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [JoinRoomArenaComponent]
    });
    fixture = TestBed.createComponent(JoinRoomArenaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
