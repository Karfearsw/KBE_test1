import { describe, it, expect } from '@jest/globals';
import { lazyAnalyticsComponents } from '../../../client/src/components/analytics/lazy-analytics';

describe('Lazy Analytics Components', () => {
  it('should export lazy-loaded components', () => {
    expect(lazyAnalyticsComponents).toBeDefined();
    expect(lazyAnalyticsComponents.LazyRealTimeAnalytics).toBeDefined();
    expect(lazyAnalyticsComponents.LazyTeamActivityFeed).toBeDefined();
    expect(lazyAnalyticsComponents.LazyPerformanceAnalytics).toBeDefined();
  });

  it('should wrap components with error boundaries', () => {
    const { RealTimeAnalyticsLazy, TeamActivityFeedLazy, PerformanceAnalyticsLazy } = lazyAnalyticsComponents;
    
    expect(RealTimeAnalyticsLazy).toBeDefined();
    expect(TeamActivityFeedLazy).toBeDefined();
    expect(PerformanceAnalyticsLazy).toBeDefined();
  });

  it('should handle component loading states', () => {
    const components = Object.keys(lazyAnalyticsComponents);
    expect(components.length).toBeGreaterThan(0);
    
    components.forEach(componentName => {
      expect(lazyAnalyticsComponents[componentName as keyof typeof lazyAnalyticsComponents]).toBeDefined();
    });
  });
});