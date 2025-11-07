import { lazy, Suspense } from 'react';
import { ChartErrorBoundary, ChartLoadingSkeleton } from './chart-error-boundary';

// Lazy-loaded analytics components
export const LazyRealTimeAnalytics = lazy(() => 
  import('./real-time-analytics/index').then(module => ({
    default: module.RealTimeAnalytics 
  }))
);

export const LazyTeamActivityFeed = lazy(() => 
  import('./team-activity-feed').then(module => ({ 
    default: module.TeamActivityFeed 
  }))
);

export const LazyPerformanceAnalytics = lazy(() => 
  import('./performance-analytics').then(module => ({ 
    default: module.PerformanceAnalytics 
  }))
);

// Wrapper components with error boundaries and loading states
export const RealTimeAnalyticsLazy = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LazyRealTimeAnalytics {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const TeamActivityFeedLazy = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LazyTeamActivityFeed {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const PerformanceAnalyticsLazy = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LazyPerformanceAnalytics {...props} />
    </Suspense>
  </ChartErrorBoundary>
);