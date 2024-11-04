import { TestBed } from '@angular/core/testing';

import { GameLobbyService } from './game-lobby.service';

describe('GameLobbyService', () => {
  let service: GameLobbyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameLobbyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
