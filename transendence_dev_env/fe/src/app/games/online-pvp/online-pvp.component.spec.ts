import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnlinePvpComponent } from './online-pvp.component';

describe('OnlinePvpComponent', () => {
  let component: OnlinePvpComponent;
  let fixture: ComponentFixture<OnlinePvpComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OnlinePvpComponent]
    });
    fixture = TestBed.createComponent(OnlinePvpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
