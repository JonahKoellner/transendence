import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateRoomChaosComponent } from './create-room-chaos.component';

describe('CreateRoomChaosComponent', () => {
  let component: CreateRoomChaosComponent;
  let fixture: ComponentFixture<CreateRoomChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CreateRoomChaosComponent]
    });
    fixture = TestBed.createComponent(CreateRoomChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
