import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChaosComponent } from './chaos.component';

describe('ChaosComponent', () => {
  let component: ChaosComponent;
  let fixture: ComponentFixture<ChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChaosComponent]
    });
    fixture = TestBed.createComponent(ChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
