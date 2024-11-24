import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JoinRoomChaosComponent } from './join-room-chaos.component';

describe('JoinRoomChaosComponent', () => {
  let component: JoinRoomChaosComponent;
  let fixture: ComponentFixture<JoinRoomChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [JoinRoomChaosComponent]
    });
    fixture = TestBed.createComponent(JoinRoomChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
