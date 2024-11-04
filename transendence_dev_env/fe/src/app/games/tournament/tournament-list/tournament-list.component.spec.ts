import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TournamentListComponent } from './tournament-list.component';

describe('TournamentListComponent', () => {
  let component: TournamentListComponent;
  let fixture: ComponentFixture<TournamentListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TournamentListComponent]
    });
    fixture = TestBed.createComponent(TournamentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
