/**
 * Performance measurement utilities for lazy loading implementation
 */

interface PerformanceMetrics {
  initialBundleSize: number;
  chartChunkSize: number;
  lazyLoadTime: number;
  prefetchTime: number;
  totalLoadTime: number;
}

export class PerformanceTracker {
  private metrics: Partial<PerformanceMetrics> = {};
  private startTime: number = 0;

  startMeasurement() {
    this.startTime = performance.now();
    console.log('📊 Starting performance measurement...');
  }

  measureInitialBundle() {
    // Measure initial bundle size (excluding lazy chunks)
    const initialChunks = Array.from(document.scripts)
      .filter(script => script.src && !script.src.includes('charting'))
      .reduce((total, script) => total + (script as any).size || 0, 0);
    
    this.metrics.initialBundleSize = initialChunks;
    console.log(`📦 Initial bundle size: ${(initialChunks / 1024).toFixed(2)} KB`);
  }

  measureChartChunk() {
    // Measure chart-specific chunk size
    const chartChunks = Array.from(document.scripts)
      .filter(script => script.src && script.src.includes('charting'))
      .reduce((total, script) => total + (script as any).size || 0, 0);
    
    this.metrics.chartChunkSize = chartChunks;
    console.log(`📈 Chart chunk size: ${(chartChunks / 1024).toFixed(2)} KB`);
  }

  measureLazyLoadTime(chunkName: string) {
    const loadTime = performance.now() - this.startTime;
    console.log(`⚡ Lazy loaded ${chunkName} in ${loadTime.toFixed(2)}ms`);
    return loadTime;
  }

  measurePrefetchTime(prefetchStart: number) {
    const prefetchTime = performance.now() - prefetchStart;
    this.metrics.prefetchTime = prefetchTime;
    console.log(`🚀 Prefetch completed in ${prefetchTime.toFixed(2)}ms`);
    return prefetchTime;
  }

  getTotalMetrics(): PerformanceMetrics {
    const totalTime = performance.now() - this.startTime;
    return {
      initialBundleSize: this.metrics.initialBundleSize || 0,
      chartChunkSize: this.metrics.chartChunkSize || 0,
      lazyLoadTime: this.metrics.lazyLoadTime || 0,
      prefetchTime: this.metrics.prefetchTime || 0,
      totalLoadTime: totalTime,
      ...this.metrics
    } as PerformanceMetrics;
  }

  logPerformanceSummary() {
    const metrics = this.getTotalMetrics();
    console.log('📊 Performance Summary:');
    console.log(`   Initial Bundle: ${(metrics.initialBundleSize / 1024).toFixed(2)} KB`);
    console.log(`   Chart Chunk: ${(metrics.chartChunkSize / 1024).toFixed(2)} KB`);
    console.log(`   Lazy Load Time: ${metrics.lazyLoadTime.toFixed(2)}ms`);
    console.log(`   Prefetch Time: ${metrics.prefetchTime.toFixed(2)}ms`);
    console.log(`   Total Load Time: ${metrics.totalLoadTime.toFixed(2)}ms`);
    
    // Calculate improvement percentage
    const totalWithoutLazy = metrics.initialBundleSize + metrics.chartChunkSize;
    const improvement = ((metrics.chartChunkSize / totalWithoutLazy) * 100).toFixed(1);
    console.log(`   📉 Bundle size reduction: ${improvement}% (charts loaded on demand)`);
  }
}

/**
 * Track lazy loading performance for specific components
 */
export function trackLazyLoad(componentName: string, loadPromise: Promise<any>) {
  const startTime = performance.now();
  
  return loadPromise.then((result) => {
    const loadTime = performance.now() - startTime;
    console.log(`✅ ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
    return result;
  }).catch((error) => {
    const loadTime = performance.now() - startTime;
    console.error(`❌ ${componentName} failed to load after ${loadTime.toFixed(2)}ms:`, error);
    throw error;
  });
}

/**
 * Measure bundle size improvements
 */
export function measureBundleImprovement() {
  // This would typically be called after the initial page load
  setTimeout(() => {
    const tracker = new PerformanceTracker();
    tracker.startMeasurement();
    tracker.measureInitialBundle();
    tracker.measureChartChunk();
    tracker.logPerformanceSummary();
  }, 1000);
}

export default PerformanceTracker;