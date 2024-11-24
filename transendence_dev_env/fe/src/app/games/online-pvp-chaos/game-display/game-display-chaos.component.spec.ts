import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameDisplayChaosComponent } from './game-display-chaos.component';

describe('GameDisplayChaosComponent', () => {
  let component: GameDisplayChaosComponent;
  let fixture: ComponentFixture<GameDisplayChaosComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GameDisplayChaosComponent]
    });
    fixture = TestBed.createComponent(GameDisplayChaosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
