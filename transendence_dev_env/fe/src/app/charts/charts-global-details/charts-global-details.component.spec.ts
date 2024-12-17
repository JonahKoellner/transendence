import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartsGlobalDetailsComponent } from './charts-global-details.component';

describe('ChartsGlobalDetailsComponent', () => {
  let component: ChartsGlobalDetailsComponent;
  let fixture: ComponentFixture<ChartsGlobalDetailsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChartsGlobalDetailsComponent]
    });
    fixture = TestBed.createComponent(ChartsGlobalDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
