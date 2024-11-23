import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RevalidateOtpComponent } from './revalidate-otp.component';

describe('RevalidateOtpComponent', () => {
  let component: RevalidateOtpComponent;
  let fixture: ComponentFixture<RevalidateOtpComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RevalidateOtpComponent]
    });
    fixture = TestBed.createComponent(RevalidateOtpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
