import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { preloadCharts, preloadSpecificCharts } from './use-chart-prefetch';
const logError = (error: any, context?: any) => {
  console.error('Error:', error, context);
};

/**
 * Hook to prefetch chart components based on current route
 */
export function useRoutePrefetch() {
  const [location] = useLocation();

  useEffect(() => {
    // Prefetch charts based on current route
    if (location.includes('/analytics')) {
      // Prefetch all analytics charts when navigating to analytics pages
      preloadSpecificCharts([
        'lead-status',
        'property-type', 
        'motivation-level',
        'lead-source',
        'deal-conversion',
        'performance-trends'
      ]).catch(error => {
        logError(error, { context: 'route-prefetch', route: location, component: 'analytics-charts' });
      });
    } else if (location.includes('/dashboard')) {
      // Prefetch dashboard charts
      preloadSpecificCharts([
        'performance-trends'
      ]).catch(error => {
        logError(error, { context: 'route-prefetch', route: location, component: 'dashboard-charts' });
      });
    }
  }, [location]);
}

/**
 * Component that handles route-based prefetching
 */
export function RoutePrefetchProvider({ children }: { children: React.ReactNode }) {
  useRoutePrefetch();
  return React.createElement(React.Fragment, null, children);
}