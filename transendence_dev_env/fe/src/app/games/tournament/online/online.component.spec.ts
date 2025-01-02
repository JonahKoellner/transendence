import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlineComponent } from './online.component';

describe('OnlineComponent', () => {
  let component: OnlineComponent;
  let fixture: ComponentFixture<OnlineComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OnlineComponent]
    });
    fixture = TestBed.createComponent(OnlineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
