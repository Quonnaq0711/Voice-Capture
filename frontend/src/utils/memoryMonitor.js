// Memory monitoring utility to help detect memory leaks
// This utility provides functions to monitor and log memory usage patterns

class MemoryMonitor {
  constructor() {
    this.intervals = new Set();
    this.timeouts = new Set();
    this.eventSources = new Set();
    this.eventListeners = new Map();
    this.isMonitoring = false;
    this.memoryLog = [];
  }

  // Start monitoring memory usage
  startMonitoring(intervalMs = 30000) { // Check every 30 seconds
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    const monitorInterval = setInterval(() => {
      this.logMemoryUsage();
    }, intervalMs);
    
    this.intervals.add(monitorInterval);
    console.log('🔍 Memory monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.isMonitoring = false;
    console.log('🛑 Memory monitoring stopped');
  }

  // Log current memory usage
  logMemoryUsage() {
    if (performance.memory) {
      const memory = {
        timestamp: new Date().toISOString(),
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024), // MB
        intervals: this.intervals.size,
        timeouts: this.timeouts.size,
        eventSources: this.eventSources.size,
        eventListeners: this.eventListeners.size
      };
      
      this.memoryLog.push(memory);
      
      // Keep only last 20 entries
      if (this.memoryLog.length > 20) {
        this.memoryLog.shift();
      }
      
      // Warn if memory usage is high
      if (memory.used > 100) { // More than 100MB
        console.warn('⚠️ High memory usage detected:', memory);
      }
      
      // Warn if too many timers/listeners
      if (memory.intervals > 10 || memory.timeouts > 20 || memory.eventSources > 5) {
        console.warn('⚠️ High number of active timers/listeners:', {
          intervals: memory.intervals,
          timeouts: memory.timeouts,
          eventSources: memory.eventSources,
          eventListeners: memory.eventListeners
        });
      }
    }
  }

  // Get memory usage history
  getMemoryLog() {
    return [...this.memoryLog];
  }

  // Track interval
  trackInterval(intervalId) {
    this.intervals.add(intervalId);
    return intervalId;
  }

  // Track timeout
  trackTimeout(timeoutId) {
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  // Track EventSource
  trackEventSource(eventSource) {
    this.eventSources.add(eventSource);
    return eventSource;
  }

  // Track event listener
  trackEventListener(element, event, handler) {
    const key = `${element.constructor.name}-${event}`;
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set());
    }
    this.eventListeners.get(key).add(handler);
  }

  // Untrack interval
  untrackInterval(intervalId) {
    this.intervals.delete(intervalId);
    clearInterval(intervalId);
  }

  // Untrack timeout
  untrackTimeout(timeoutId) {
    this.timeouts.delete(timeoutId);
    clearTimeout(timeoutId);
  }

  // Untrack EventSource
  untrackEventSource(eventSource) {
    this.eventSources.delete(eventSource);
    if (eventSource && typeof eventSource.close === 'function') {
      eventSource.close();
    }
  }

  // Untrack event listener
  untrackEventListener(element, event, handler) {
    const key = `${element.constructor.name}-${event}`;
    if (this.eventListeners.has(key)) {
      this.eventListeners.get(key).delete(handler);
      if (this.eventListeners.get(key).size === 0) {
        this.eventListeners.delete(key);
      }
    }
    element.removeEventListener(event, handler);
  }

  // Clean up all tracked resources
  cleanup() {
    console.log('🧹 Cleaning up all tracked resources...');
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    // Close all EventSources
    this.eventSources.forEach(eventSource => {
      if (eventSource && typeof eventSource.close === 'function') {
        eventSource.close();
      }
    });
    this.eventSources.clear();
    
    // Clear event listeners map
    this.eventListeners.clear();
    
    this.isMonitoring = false;
    console.log('✅ All resources cleaned up');
  }

  // Get current resource counts
  getResourceCounts() {
    return {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      eventSources: this.eventSources.size,
      eventListeners: this.eventListeners.size
    };
  }

  // Print memory report
  printMemoryReport() {
    console.group('📊 Memory Monitor Report');
    console.log('Resource counts:', this.getResourceCounts());
    console.log('Recent memory usage:', this.memoryLog.slice(-5));
    console.groupEnd();
  }
}

// Create singleton instance
const memoryMonitor = new MemoryMonitor();

// Enhanced wrapper functions for better tracking
export const createInterval = (callback, delay) => {
  const intervalId = setInterval(callback, delay);
  return memoryMonitor.trackInterval(intervalId);
};

export const createTimeout = (callback, delay) => {
  const timeoutId = setTimeout(callback, delay);
  return memoryMonitor.trackTimeout(timeoutId);
};

export const createEventSource = (url) => {
  const eventSource = new EventSource(url);
  return memoryMonitor.trackEventSource(eventSource);
};

export const addEventListener = (element, event, handler, options) => {
  element.addEventListener(event, handler, options);
  memoryMonitor.trackEventListener(element, event, handler);
  return () => memoryMonitor.untrackEventListener(element, event, handler);
};

export const clearTrackedInterval = (intervalId) => {
  memoryMonitor.untrackInterval(intervalId);
};

export const clearTrackedTimeout = (timeoutId) => {
  memoryMonitor.untrackTimeout(timeoutId);
};

export const closeTrackedEventSource = (eventSource) => {
  memoryMonitor.untrackEventSource(eventSource);
};

// Development mode helpers
if (process.env.NODE_ENV === 'development') {
  // Expose to window for debugging
  window.memoryMonitor = memoryMonitor;
  
  // Auto-start monitoring in development
  memoryMonitor.startMonitoring();
  
  // Log memory report every 2 minutes
  setInterval(() => {
    memoryMonitor.printMemoryReport();
  }, 120000);
  
  console.log('🔧 Memory monitoring enabled in development mode');
  console.log('Use window.memoryMonitor to access monitoring functions');
}

export default memoryMonitor;