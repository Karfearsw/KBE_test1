import { lazy, Suspense } from 'react';
import { ChartErrorBoundary, ChartLoadingSkeleton } from './chart-error-boundary';

// Lazy-loaded chart components for analytics page
export const LeadStatusChart = lazy(() => 
  import('./charts/lead-status-chart').then(module => ({ 
    default: module.LeadStatusChart 
  }))
);

export const PropertyTypeChart = lazy(() => 
  import('./charts/property-type-chart').then(module => ({ 
    default: module.PropertyTypeChart 
  }))
);

export const MotivationLevelChart = lazy(() => 
  import('./charts/motivation-level-chart').then(module => ({ 
    default: module.MotivationLevelChart 
  }))
);

export const LeadSourceChart = lazy(() => 
  import('./charts/lead-source-chart').then(module => ({ 
    default: module.LeadSourceChart 
  }))
);

export const DealConversionChart = lazy(() => 
  import('./charts/deal-conversion-chart').then(module => ({ 
    default: module.DealConversionChart 
  }))
);

export const PerformanceTrendsChart = lazy(() => 
  import('./charts/performance-trends-chart').then(module => ({ 
    default: module.PerformanceTrendsChart 
  }))
);

// Wrapper components with error boundaries and loading states
export const LazyLeadStatusChart = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LeadStatusChart {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const LazyPropertyTypeChart = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <PropertyTypeChart {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const LazyMotivationLevelChart = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <MotivationLevelChart {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const LazyLeadSourceChart = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <LeadSourceChart {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const LazyDealConversionChart = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <DealConversionChart {...props} />
    </Suspense>
  </ChartErrorBoundary>
);

export const LazyPerformanceTrendsChart = (props: any) => (
  <ChartErrorBoundary>
    <Suspense fallback={<ChartLoadingSkeleton />}>
      <PerformanceTrendsChart {...props} />
    </Suspense>
  </ChartErrorBoundary>
);