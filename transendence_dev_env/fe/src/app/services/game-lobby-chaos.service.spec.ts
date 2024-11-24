import { TestBed } from '@angular/core/testing';

import { GameLobbyChaosService } from './game-lobby-chaos.service';

describe('GameLobbyChaosService', () => {
  let service: GameLobbyChaosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameLobbyChaosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
