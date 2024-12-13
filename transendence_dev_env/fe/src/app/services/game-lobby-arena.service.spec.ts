import { TestBed } from '@angular/core/testing';

import { GameLobbyArenaService } from './game-lobby-arena.service';

describe('GameLobbyArenaService', () => {
  let service: GameLobbyArenaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameLobbyArenaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
