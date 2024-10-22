import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameInviteDialogComponent } from './game-invite-dialog.component';

describe('GameInviteDialogComponent', () => {
  let component: GameInviteDialogComponent;
  let fixture: ComponentFixture<GameInviteDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameInviteDialogComponent]
    });
    fixture = TestBed.createComponent(GameInviteDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
