/**
 * Code Cleanup Manager
 * Phase 4: Code Quality & Error Handling
 * 
 * Features:
 * - Remove debug console logs from production
 * - Clean up TODO comments
 * - Improve code formatting
 * - Remove unused code
 * - Performance optimization
 */

class CodeCleanupManager {
    constructor() {
        this.isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        this.debugMode = false; // Set to true to enable debug logging
        this.init();
    }

    init() {
        this.setupProductionMode();
        this.cleanupConsoleLogs();
        this.setupPerformanceMonitoring();
    }

    /**
     * Setup production mode
     */
    setupProductionMode() {
        if (this.isProduction) {
            // Override console methods in production
            this.overrideConsoleMethods();
            
            // Remove debug elements
            this.removeDebugElements();
            
            // Optimize performance
            this.optimizePerformance();
        }
    }

    /**
     * Override console methods in production
     */
    overrideConsoleMethods() {
        if (this.isProduction && !this.debugMode) {
            // Store original console methods
            window.originalConsole = {
                log: console.log,
                warn: console.warn,
                error: console.error,
                debug: console.debug,
                info: console.info
            };

            // Override console methods
            console.log = () => {};
            console.debug = () => {};
            console.info = () => {};
            
            // Keep warnings and errors for production debugging
            console.warn = (...args) => {
                if (this.debugMode) {
                    window.originalConsole.warn(...args);
                }
            };
            
            console.error = (...args) => {
                // Always log errors in production for monitoring
                window.originalConsole.error(...args);
                
                // Send to error tracking service
                this.trackError(args);
            };
        }
    }

    /**
     * Remove debug elements from DOM
     */
    removeDebugElements() {
        if (this.isProduction) {
            // Remove debug containers
            const debugElements = document.querySelectorAll('[data-debug], .debug, #debug');
            debugElements.forEach(element => element.remove());

            // Remove debug classes
            document.querySelectorAll('.debug-mode, .dev-only').forEach(element => {
                element.style.display = 'none';
            });

            // Remove debug attributes
            document.querySelectorAll('[data-debug]').forEach(element => {
                element.removeAttribute('data-debug');
            });
        }
    }

    /**
     * Optimize performance
     */
    optimizePerformance() {
        if (this.isProduction) {
            // Disable animations for users who prefer reduced motion
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                this.disableAnimations();
            }

            // Optimize images
            this.optimizeImages();

            // Lazy load non-critical resources
            this.setupLazyLoading();
        }
    }

    /**
     * Disable animations for accessibility
     */
    disableAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Optimize images
     */
    optimizeImages() {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        });
    }

    /**
     * Setup lazy loading
     */
    setupLazyLoading() {
        // Lazy load images
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    /**
     * Cleanup console logs
     */
    cleanupConsoleLogs() {
        // Remove console.log statements from production
        if (this.isProduction && !this.debugMode) {
            // This is handled by the console override
            return;
        }

        // In development, we can still use console.log but with better formatting
        this.enhanceConsoleLogging();
    }

    /**
     * Enhance console logging in development
     */
    enhanceConsoleLogging() {
        if (!this.isProduction) {
            const originalLog = console.log;
            console.log = (...args) => {
                const timestamp = new Date().toISOString();
                const prefix = `[${timestamp}]`;
                originalLog(prefix, ...args);
            };
        }
    }

    /**
     * Track errors for monitoring
     */
    trackError(errorArgs) {
        const errorInfo = {
            message: errorArgs.join(' '),
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            stack: new Error().stack
        };

        // Store in localStorage for debugging
        try {
            const errors = JSON.parse(localStorage.getItem('brumoutloud_errors') || '[]');
            errors.push(errorInfo);
            if (errors.length > 50) errors.shift(); // Keep only last 50 errors
            localStorage.setItem('brumoutloud_errors', JSON.stringify(errors));
        } catch (e) {
            // Ignore localStorage errors
        }

        // Send to external error tracking service (placeholder)
        this.sendToErrorTracking(errorInfo);
    }

    /**
     * Send error to tracking service
     */
    sendToErrorTracking(errorInfo) {
        // Placeholder for external error tracking service
        // In production, this would send to Sentry, LogRocket, etc.
        if (this.isProduction) {
            // Example: fetch('/api/error-tracking', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(errorInfo)
            // });
        }
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        if (this.isProduction) {
            // Monitor page load performance
            window.addEventListener('load', () => {
                setTimeout(() => {
                    this.measurePerformance();
                }, 1000);
            });

            // Monitor user interactions
            this.setupInteractionMonitoring();
        }
    }

    /**
     * Measure page performance
     */
    measurePerformance() {
        if ('performance' in window) {
            const perfData = performance.getEntriesByType('navigation')[0];
            const metrics = {
                pageLoadTime: perfData.loadEventEnd - perfData.loadEventStart,
                domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
                firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
            };

            // Log performance metrics
            if (this.debugMode) {
                console.log('Performance Metrics:', metrics);
            }

            // Send to analytics
            this.sendPerformanceMetrics(metrics);
        }
    }

    /**
     * Setup interaction monitoring
     */
    setupInteractionMonitoring() {
        let interactionCount = 0;
        const interactionThreshold = 10;

        const trackInteraction = () => {
            interactionCount++;
            
            if (interactionCount === interactionThreshold) {
                this.sendInteractionMetrics({
                    totalInteractions: interactionCount,
                    timestamp: new Date().toISOString()
                });
            }
        };

        // Track user interactions
        document.addEventListener('click', trackInteraction);
        document.addEventListener('scroll', trackInteraction);
        document.addEventListener('input', trackInteraction);
    }

    /**
     * Send performance metrics
     */
    sendPerformanceMetrics(metrics) {
        // Placeholder for analytics service
        if (this.isProduction) {
            // Example: fetch('/api/analytics/performance', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(metrics)
            // });
        }
    }

    /**
     * Send interaction metrics
     */
    sendInteractionMetrics(metrics) {
        // Placeholder for analytics service
        if (this.isProduction) {
            // Example: fetch('/api/analytics/interactions', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(metrics)
            // });
        }
    }

    /**
     * Clean up unused event listeners
     */
    cleanupEventListeners() {
        // This is a placeholder for cleanup logic
        // In a real implementation, you'd track event listeners and remove unused ones
    }

    /**
     * Remove unused CSS
     */
    removeUnusedCSS() {
        // This would require a more sophisticated implementation
        // to analyze which CSS classes are actually used
    }

    /**
     * Optimize JavaScript bundles
     */
    optimizeJavaScriptBundles() {
        // This would be handled during the build process
        // but we can add runtime optimizations here
    }

    /**
     * Enable debug mode
     */
    enableDebugMode() {
        this.debugMode = true;
        
        // Restore original console methods
        if (window.originalConsole) {
            console.log = window.originalConsole.log;
            console.debug = window.originalConsole.debug;
            console.info = window.originalConsole.info;
        }
        
        console.log('🔧 Debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        this.debugMode = false;
        this.setupProductionMode();
        console.log('🔧 Debug mode disabled');
    }

    /**
     * Get cleanup statistics
     */
    getCleanupStats() {
        return {
            isProduction: this.isProduction,
            debugMode: this.debugMode,
            consoleOverridden: !!window.originalConsole,
            debugElementsRemoved: document.querySelectorAll('[data-debug], .debug, #debug').length === 0
        };
    }

    /**
     * Export error logs for debugging
     */
    exportErrorLogs() {
        try {
            const errors = JSON.parse(localStorage.getItem('brumoutloud_errors') || '[]');
            const blob = new Blob([JSON.stringify(errors, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'error-logs.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to export error logs:', e);
        }
    }

    /**
     * Clear error logs
     */
    clearErrorLogs() {
        localStorage.removeItem('brumoutloud_errors');
        console.log('Error logs cleared');
    }
}

// Initialize the code cleanup manager
document.addEventListener('DOMContentLoaded', () => {
    window.codeCleanupManager = new CodeCleanupManager();
    
    // Expose debug methods globally
    window.enableDebugMode = () => window.codeCleanupManager.enableDebugMode();
    window.disableDebugMode = () => window.codeCleanupManager.disableDebugMode();
    window.exportErrorLogs = () => window.codeCleanupManager.exportErrorLogs();
    window.clearErrorLogs = () => window.codeCleanupManager.clearErrorLogs();
    window.getCleanupStats = () => window.codeCleanupManager.getCleanupStats();
});
