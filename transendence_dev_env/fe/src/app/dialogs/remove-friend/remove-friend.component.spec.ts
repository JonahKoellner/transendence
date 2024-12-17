import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoveFriendComponent } from './remove-friend.component';

describe('RemoveFriendComponent', () => {
  let component: RemoveFriendComponent;
  let fixture: ComponentFixture<RemoveFriendComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RemoveFriendComponent]
    });
    fixture = TestBed.createComponent(RemoveFriendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
