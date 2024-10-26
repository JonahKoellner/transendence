import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LocalPvpComponent } from './local-pvp.component';

describe('LocalPvpComponent', () => {
  let component: LocalPvpComponent;
  let fixture: ComponentFixture<LocalPvpComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LocalPvpComponent]
    });
    fixture = TestBed.createComponent(LocalPvpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
