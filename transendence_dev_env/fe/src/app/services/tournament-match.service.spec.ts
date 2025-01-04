import { TestBed } from '@angular/core/testing';

import { TournamentMatchService } from './tournament-match.service';

describe('TournamentMatchService', () => {
  let service: TournamentMatchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TournamentMatchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
