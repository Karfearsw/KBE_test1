import { useState, useEffect } from 'react';

// Performance optimization utilities for high-frequency data updates

interface DebounceOptions {
  delay: number;
  immediate?: boolean;
}

interface ThrottleOptions {
  delay: number;
  leading?: boolean;
  trailing?: boolean;
}

export class DataUpdateOptimizer {
  private pendingUpdates: Map<string, any> = new Map();
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private batchSize: number;
  private flushInterval: number;

  constructor(batchSize: number = 10, flushInterval: number = 100) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.startBatchProcessor();
  }

  // Debounce function for reducing update frequency
  debounce<T extends (...args: any[]) => any>(
    func: T,
    options: DebounceOptions = { delay: 300 }
  ): T {
    let timeout: NodeJS.Timeout | null = null;
    
    return ((...args: Parameters<T>) => {
      const later = () => {
        timeout = null;
        if (!options.immediate) func(...args);
      };
      
      const callNow = options.immediate && !timeout;
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, options.delay);
      
      if (callNow) func(...args);
    }) as T;
  }

  // Throttle function for limiting update rate
  throttle<T extends (...args: any[]) => any>(
    func: T,
    options: ThrottleOptions = { delay: 100, leading: true, trailing: true }
  ): T {
    let timeout: NodeJS.Timeout | null = null;
    let lastCallTime = 0;
    let lastArgs: Parameters<T> | null = null;
    
    return ((...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = options.delay - (now - lastCallTime);
      lastArgs = args;
      
      if (remaining <= 0 || remaining > options.delay) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        
        if (options.leading) {
          lastCallTime = now;
          func(...args);
        } else {
          lastCallTime = now;
        }
      } else if (!timeout && options.trailing) {
        timeout = setTimeout(() => {
          lastCallTime = Date.now();
          timeout = null;
          if (lastArgs) func(...lastArgs);
        }, remaining);
      }
    }) as T;
  }

  // Batch multiple updates together
  batchUpdate(key: string, data: any) {
    this.pendingUpdates.set(key, data);
    
    // Flush immediately if batch size is reached
    if (this.pendingUpdates.size >= this.batchSize) {
      this.flushUpdates();
    }
  }

  // Subscribe to batched updates for a specific key
  subscribe(key: string, callback: (data: any) => void) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  // Process pending updates in batches
  private flushUpdates() {
    if (this.pendingUpdates.size === 0) return;

    // Group updates by subscriber key
    const updatesByKey = new Map<string, any[]>();
    
    this.pendingUpdates.forEach((data, key) => {
      const subscribers = this.subscribers.get(key);
      if (subscribers && subscribers.size > 0) {
        if (!updatesByKey.has(key)) {
          updatesByKey.set(key, []);
        }
        updatesByKey.get(key)!.push(data);
      }
    });

    // Notify subscribers with batched data
    updatesByKey.forEach((updates, key) => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        const batchedData = updates.length === 1 ? updates[0] : updates;
        callbacks.forEach(callback => {
          try {
            callback(batchedData);
          } catch (error) {
            console.error('Error in update callback:', error);
          }
        });
      }
    });

    this.pendingUpdates.clear();
  }

  // Start automatic batch processor
  private startBatchProcessor() {
    setInterval(() => {
      this.flushUpdates();
    }, this.flushInterval);
  }

  // Clean up resources
  destroy() {
    this.updateTimers.forEach(timer => clearTimeout(timer));
    this.updateTimers.clear();
    this.pendingUpdates.clear();
    this.subscribers.clear();
  }
}

// React Hook for optimized data updates
export function useOptimizedUpdates<T>(
  key: string,
  initialData: T,
  options: {
    debounceDelay?: number;
    throttleDelay?: number;
    batchSize?: number;
  } = {}
) {
  const [data, setData] = useState<T>(initialData);
  const [optimizer] = useState(() => new DataUpdateOptimizer(options.batchSize || 10));
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = optimizer.subscribe(key, (newData) => {
      setIsUpdating(true);
      setData(newData);
      
      // Simulate processing time
      setTimeout(() => setIsUpdating(false), 50);
    });

    return unsubscribe;
  }, [key, optimizer]);

  const updateData = optimizer.debounce(
    (newData: T) => {
      optimizer.batchUpdate(key, newData);
    },
    { delay: options.debounceDelay || 300 }
  );

  const throttledUpdate = optimizer.throttle(
    (newData: T) => {
      optimizer.batchUpdate(key, newData);
    },
    { delay: options.throttleDelay || 100 }
  );

  useEffect(() => {
    return () => {
      optimizer.destroy();
    };
  }, [optimizer]);

  return {
    data,
    updateData,
    throttledUpdate,
    isUpdating,
    optimizer
  };
}

// Utility for managing high-frequency WebSocket updates
export class WebSocketUpdateManager {
  private updateBuffer: Map<string, any[]> = new Map();
  private flushInterval: number;
  private maxBufferSize: number;
  private callbacks: Map<string, Set<(data: any) => void>> = new Map();

  constructor(flushInterval: number = 50, maxBufferSize: number = 100) {
    this.flushInterval = flushInterval;
    this.maxBufferSize = maxBufferSize;
    this.startBufferProcessor();
  }

  // Add update to buffer
  addUpdate(key: string, data: any) {
    if (!this.updateBuffer.has(key)) {
      this.updateBuffer.set(key, []);
    }
    
    const buffer = this.updateBuffer.get(key)!;
    buffer.push(data);

    // Prevent memory leaks by limiting buffer size
    if (buffer.length > this.maxBufferSize) {
      buffer.shift(); // Remove oldest item
    }
  }

  // Subscribe to buffered updates
  subscribe(key: string, callback: (data: any) => void) {
    if (!this.callbacks.has(key)) {
      this.callbacks.set(key, new Set());
    }
    this.callbacks.get(key)!.add(callback);

    return () => {
      const callbacks = this.callbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.callbacks.delete(key);
          this.updateBuffer.delete(key);
        }
      }
    };
  }

  // Process buffered updates
  private processBuffer() {
    this.updateBuffer.forEach((buffer, key) => {
      if (buffer.length === 0) return;

      const callbacks = this.callbacks.get(key);
      if (!callbacks || callbacks.size === 0) return;

      // Send batched updates
      const batchedData = buffer.length === 1 ? buffer[0] : [...buffer];
      callbacks.forEach(callback => {
        try {
          callback(batchedData);
        } catch (error) {
          console.error('Error in WebSocket callback:', error);
        }
      });

      // Clear buffer after processing
      buffer.length = 0;
    });
  }

  // Start buffer processor
  private startBufferProcessor() {
    setInterval(() => {
      this.processBuffer();
    }, this.flushInterval);
  }

  // Get buffer statistics
  getStats() {
    const stats = {
      totalKeys: this.updateBuffer.size,
      totalCallbacks: Array.from(this.callbacks.values()).reduce((sum, set) => sum + set.size, 0),
      bufferSizes: new Map<string, number>()
    };

    this.updateBuffer.forEach((buffer, key) => {
      stats.bufferSizes.set(key, buffer.length);
    });

    return stats;
  }

  // Clean up resources
  destroy() {
    this.updateBuffer.clear();
    this.callbacks.clear();
  }
}

// Performance monitoring utility
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  // Start timing an operation
  startTimer(name: string) {
    this.startTimes.set(name, performance.now());
  }

  // End timing and record metric
  endTimer(name: string) {
    const startTime = this.startTimes.get(name);
    if (!startTime) return;

    const duration = performance.now() - startTime;
    this.recordMetric(name, duration);
    this.startTimes.delete(name);
  }

  // Record a metric value
  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 100 values to prevent memory leaks
    if (values.length > 100) {
      values.shift();
    }
  }

  // Get average metric value
  getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // Get metric statistics
  getStats(name: string) {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    
    return {
      count,
      average: sum / count,
      min: sorted[0],
      max: sorted[count - 1],
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    };
  }

  // Get all metric names
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  // Clear all metrics
  clear() {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

// Export singleton instances for global use
export const dataUpdateOptimizer = new DataUpdateOptimizer();
export const webSocketUpdateManager = new WebSocketUpdateManager();
export const performanceMonitor = new PerformanceMonitor();