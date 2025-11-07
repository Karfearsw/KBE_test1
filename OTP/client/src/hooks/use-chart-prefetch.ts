import { useEffect, useRef, useState } from 'react';

interface UseChartPrefetchOptions {
  delay?: number;
  threshold?: number;
  rootMargin?: string;
}

/**
 * Hook to prefetch chart components when they come into viewport or on hover
 */
export function useChartPrefetch(
  onPrefetch: () => void,
  options: UseChartPrefetchOptions = {}
) {
  const {
    delay = 100,
    threshold = 0.1,
    rootMargin = '50px'
  } = options;

  const elementRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasPrefetched, setHasPrefetched] = useState(false);

  // Intersection Observer for viewport-based prefetching
  useEffect(() => {
    if (hasPrefetched || !elementRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPrefetched) {
            setTimeout(() => {
              onPrefetch();
              setHasPrefetched(true);
            }, delay);
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    observer.observe(elementRef.current);

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [onPrefetch, hasPrefetched, delay, threshold, rootMargin]);

  // Hover-based prefetching
  useEffect(() => {
    if (isHovered && !hasPrefetched) {
      const timer = setTimeout(() => {
        onPrefetch();
        setHasPrefetched(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [isHovered, hasPrefetched, delay, onPrefetch]);

  return {
    ref: elementRef,
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    hasPrefetched
  };
}

/**
 * Preload all chart components for immediate availability
 */
export function preloadCharts() {
  // Preload all chart components
  const chartImports = [
    import('@/components/analytics/charts/lead-status-chart'),
    import('@/components/analytics/charts/property-type-chart'),
    import('@/components/analytics/charts/motivation-level-chart'),
    import('@/components/analytics/charts/lead-source-chart'),
    import('@/components/analytics/charts/deal-conversion-chart'),
    import('@/components/analytics/charts/performance-trends-chart')
  ];

  return Promise.all(chartImports);
}

/**
 * Preload specific chart components
 */
export function preloadSpecificCharts(chartNames: string[]) {
  const chartMap: Record<string, () => Promise<any>> = {
    'lead-status': () => import('@/components/analytics/charts/lead-status-chart'),
    'property-type': () => import('@/components/analytics/charts/property-type-chart'),
    'motivation-level': () => import('@/components/analytics/charts/motivation-level-chart'),
    'lead-source': () => import('@/components/analytics/charts/lead-source-chart'),
    'deal-conversion': () => import('@/components/analytics/charts/deal-conversion-chart'),
    'performance-trends': () => import('@/components/analytics/charts/performance-trends-chart')
  };

  const imports = chartNames
    .filter(name => chartMap[name])
    .map(name => chartMap[name]());

  return Promise.all(imports);
}