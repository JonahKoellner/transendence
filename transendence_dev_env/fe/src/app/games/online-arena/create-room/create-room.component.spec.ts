import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateRoomArenaComponent } from './create-room.component';

describe('CreateRoomArenaComponent', () => {
  let component: CreateRoomArenaComponent;
  let fixture: ComponentFixture<CreateRoomArenaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CreateRoomArenaComponent]
    });
    fixture = TestBed.createComponent(CreateRoomArenaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
