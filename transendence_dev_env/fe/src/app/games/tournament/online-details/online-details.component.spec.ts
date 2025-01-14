import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlineDetailsComponent } from './online-details.component';

describe('OnlineDetailsComponent', () => {
  let component: OnlineDetailsComponent;
  let fixture: ComponentFixture<OnlineDetailsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OnlineDetailsComponent]
    });
    fixture = TestBed.createComponent(OnlineDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
