import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocalPveComponent } from './local-pve.component';

describe('LocalPveComponent', () => {
  let component: LocalPveComponent;
  let fixture: ComponentFixture<LocalPveComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LocalPveComponent]
    });
    fixture = TestBed.createComponent(LocalPveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
