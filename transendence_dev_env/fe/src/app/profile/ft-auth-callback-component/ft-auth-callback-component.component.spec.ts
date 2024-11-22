import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FtAuthCallbackComponentComponent } from './ft-auth-callback-component.component';

describe('FtAuthCallbackComponentComponent', () => {
  let component: FtAuthCallbackComponentComponent;
  let fixture: ComponentFixture<FtAuthCallbackComponentComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FtAuthCallbackComponentComponent]
    });
    fixture = TestBed.createComponent(FtAuthCallbackComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
