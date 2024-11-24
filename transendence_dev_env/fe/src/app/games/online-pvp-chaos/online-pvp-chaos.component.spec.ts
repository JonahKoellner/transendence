import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlinePvpChaosComponent } from './online-pvp-chaos.component';

describe('OnlinePvpChaosComponent', () => {
  let component: OnlinePvpChaosComponent;
  let fixture: ComponentFixture<OnlinePvpChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OnlinePvpChaosComponent]
    });
    fixture = TestBed.createComponent(OnlinePvpChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
