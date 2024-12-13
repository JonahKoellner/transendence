import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlineArenaComponent } from './online-arena.component';

describe('OnlineArenaComponent', () => {
  let component: OnlineArenaComponent;
  let fixture: ComponentFixture<OnlineArenaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OnlineArenaComponent]
    });
    fixture = TestBed.createComponent(OnlineArenaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
