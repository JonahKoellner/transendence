import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartsUserDetailsComponent } from './charts-user-details.component';

describe('ChartsUserDetailsComponent', () => {
  let component: ChartsUserDetailsComponent;
  let fixture: ComponentFixture<ChartsUserDetailsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChartsUserDetailsComponent]
    });
    fixture = TestBed.createComponent(ChartsUserDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
