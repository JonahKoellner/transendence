import { TestBed } from '@angular/core/testing';

import { StatsAnalyticsService } from './stats-analytics.service';

describe('StatsAnalyticsService', () => {
  let service: StatsAnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StatsAnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
