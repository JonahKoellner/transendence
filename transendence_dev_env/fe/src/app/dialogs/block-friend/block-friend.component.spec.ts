import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockFriendComponent } from './block-friend.component';

describe('BlockFriendComponent', () => {
  let component: BlockFriendComponent;
  let fixture: ComponentFixture<BlockFriendComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BlockFriendComponent]
    });
    fixture = TestBed.createComponent(BlockFriendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
