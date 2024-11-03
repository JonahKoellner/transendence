import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TournamentStatsComponent } from './tournament-stats.component';

describe('TournamentStatsComponent', () => {
  let component: TournamentStatsComponent;
  let fixture: ComponentFixture<TournamentStatsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TournamentStatsComponent]
    });
    fixture = TestBed.createComponent(TournamentStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
