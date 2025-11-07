import { lazy, Suspense } from 'react';
import { ChartErrorBoundary, ChartLoadingSkeleton } from '@/components/analytics/chart-error-boundary';

// Lazy-loaded dashboard components
export const LazySummaryMetrics = lazy(() => 
  import('@/components/dashboard/summary-metrics').then(module => ({ 
    default: module.SummaryMetrics 
  }))
);

export const LazyDealPipeline = lazy(() => 
  import('@/components/dashboard/deal-pipeline').then(module => ({ 
    default: module.DealPipeline 
  }))
);

export const LazyTeamPerformance = lazy(() => 
  import('@/components/dashboard/team-performance').then(module => ({ 
    default: module.TeamPerformance 
  }))
);

// Wrapper components with error boundaries and loading states
export const SummaryMetricsLazy = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LazySummaryMetrics {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const DealPipelineLazy = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LazyDealPipeline {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const TeamPerformanceLazy = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LazyTeamPerformance {...props} />
    </Suspense>
  </ChartErrorBoundary>
);