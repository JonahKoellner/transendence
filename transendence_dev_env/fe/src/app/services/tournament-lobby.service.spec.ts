import { TestBed } from '@angular/core/testing';

import { TournamentLobbyService } from './tournament-lobby.service';

describe('TournamentLobbyService', () => {
  let service: TournamentLobbyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TournamentLobbyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
