import { TestBed } from '@angular/core/testing';

import { FtAuthService } from './ft-auth.service';

describe('FtAuthService', () => {
  let service: FtAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FtAuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
