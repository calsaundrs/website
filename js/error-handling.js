/**
 * Production Error Handling & Logging System
 * Phase 4: Code Quality & Error Handling
 */

class ErrorHandler {
    constructor() {
        this.isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        this.errorCount = 0;
        this.maxErrors = 10; // Prevent infinite error loops
        this.init();
    }

    init() {
        this.setupGlobalErrorHandling();
        this.setupUnhandledRejectionHandling();
        this.setupPerformanceMonitoring();
    }

    /**
     * Setup global error handling
     */
    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            this.handleError(event.error || event.message, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
    }

    /**
     * Setup unhandled promise rejection handling
     */
    setupUnhandledRejectionHandling() {
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, {
                type: 'unhandledrejection',
                stack: event.reason?.stack
            });
        });
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        if ('performance' in window) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    this.logPerformance();
                }, 1000);
            });
        }
    }

    /**
     * Handle errors with appropriate logging
     */
    handleError(error, context = {}) {
        this.errorCount++;
        
        if (this.errorCount > this.maxErrors) {
            return; // Prevent infinite error loops
        }

        const errorInfo = {
            message: error?.message || error,
            stack: error?.stack || context.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            ...context
        };

        // In production, log to external service (e.g., Sentry, LogRocket)
        if (this.isProduction) {
            this.logToExternalService(errorInfo);
        } else {
            // In development, use console.error
            console.error('Error:', errorInfo);
        }

        // Show user-friendly error message for critical errors
        this.showUserFriendlyError(error);
    }

    /**
     * Log to external service (placeholder for production)
     */
    logToExternalService(errorInfo) {
        // In production, this would send to your error tracking service
        // For now, we'll just store in localStorage for debugging
        try {
            const errors = JSON.parse(localStorage.getItem('brumoutloud_errors') || '[]');
            errors.push(errorInfo);
            if (errors.length > 50) errors.shift(); // Keep only last 50 errors
            localStorage.setItem('brumoutloud_errors', JSON.stringify(errors));
        } catch (e) {
            // Fallback if localStorage fails
        }
    }

    /**
     * Show user-friendly error message
     */
    showUserFriendlyError(error) {
        // Only show for critical errors that affect user experience
        const criticalErrors = [
            'Failed to fetch',
            'NetworkError',
            'TypeError',
            'ReferenceError'
        ];

        const isCritical = criticalErrors.some(type => 
            error?.message?.includes(type) || error?.name === type
        );

        if (isCritical) {
            this.showErrorNotification('Something went wrong. Please refresh the page or try again later.');
        }
    }

    /**
     * Show error notification to user
     */
    showErrorNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button class="error-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add styles
        if (!document.getElementById('error-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'error-notification-styles';
            style.textContent = `
                .error-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #dc2626;
                    color: white;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    max-width: 400px;
                    animation: slideIn 0.3s ease;
                }
                
                .error-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .error-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: auto;
                }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    /**
     * Log performance metrics
     */
    logPerformance() {
        const perfData = performance.getEntriesByType('navigation')[0];
        if (perfData) {
            const metrics = {
                loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
                firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
                timestamp: new Date().toISOString(),
                url: window.location.href
            };

            if (this.isProduction) {
                this.logToExternalService({ type: 'performance', ...metrics });
            } else {
                console.log('Performance metrics:', metrics);
            }
        }
    }

    /**
     * Safe console logging (only in development)
     */
    static log(...args) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(...args);
        }
    }

    /**
     * Safe console warning (only in development)
     */
    static warn(...args) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn(...args);
        }
    }

    /**
     * Safe console error (always logged)
     */
    static error(...args) {
        console.error(...args);
    }
}

/**
 * Form validation and error handling
 */
class FormErrorHandler {
    constructor() {
        this.errorHandler = new ErrorHandler();
    }

    /**
     * Validate form and show errors
     */
    validateForm(form) {
        const errors = [];
        const inputs = form.querySelectorAll('input, textarea, select');

        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                errors.push(`${input.name || input.id || 'Field'} is required`);
                this.highlightError(input);
            } else if (input.type === 'email' && input.value && !this.isValidEmail(input.value)) {
                errors.push('Please enter a valid email address');
                this.highlightError(input);
            } else {
                this.clearError(input);
            }
        });

        if (errors.length > 0) {
            this.showFormErrors(errors);
            return false;
        }

        return true;
    }

    /**
     * Highlight field with error
     */
    highlightError(input) {
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
    }

    /**
     * Clear error highlighting
     */
    clearError(input) {
        input.classList.remove('error');
        input.setAttribute('aria-invalid', 'false');
    }

    /**
     * Show form validation errors
     */
    showFormErrors(errors) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'form-errors';
        errorContainer.innerHTML = `
            <div class="error-header">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Please fix the following errors:</span>
            </div>
            <ul>
                ${errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
        `;

        // Add styles if not already present
        if (!document.getElementById('form-error-styles')) {
            const style = document.createElement('style');
            style.id = 'form-error-styles';
            style.textContent = `
                .form-errors {
                    background: #dc2626;
                    color: white;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    margin-bottom: 1rem;
                }
                
                .error-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: bold;
                    margin-bottom: 0.5rem;
                }
                
                .form-errors ul {
                    margin: 0;
                    padding-left: 1.5rem;
                }
                
                .form-errors li {
                    margin-bottom: 0.25rem;
                }
                
                input.error, textarea.error, select.error {
                    border-color: #dc2626 !important;
                    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2) !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Insert at top of form
        const form = document.querySelector('form');
        if (form) {
            form.insertBefore(errorContainer, form.firstChild);
        }
    }

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Handle form submission errors
     */
    handleSubmissionError(error, form) {
        this.errorHandler.handleError(error, { type: 'form_submission', formId: form.id });
        
        const message = this.getUserFriendlyErrorMessage(error);
        this.showFormErrors([message]);
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyErrorMessage(error) {
        if (error.message?.includes('Failed to fetch')) {
            return 'Network error. Please check your connection and try again.';
        } else if (error.message?.includes('timeout')) {
            return 'Request timed out. Please try again.';
        } else if (error.status === 429) {
            return 'Too many requests. Please wait a moment and try again.';
        } else if (error.status >= 500) {
            return 'Server error. Please try again later.';
        } else {
            return 'An error occurred. Please try again.';
        }
    }
}

/**
 * Network error handling
 */
class NetworkErrorHandler {
    constructor() {
        this.errorHandler = new ErrorHandler();
        this.retryAttempts = 0;
        this.maxRetries = 3;
    }

    /**
     * Fetch with retry logic
     */
    async fetchWithRetry(url, options = {}) {
        while (this.retryAttempts < this.maxRetries) {
            try {
                const response = await fetch(url, options);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response;
            } catch (error) {
                this.retryAttempts++;
                
                if (this.retryAttempts >= this.maxRetries) {
                    this.errorHandler.handleError(error, { 
                        type: 'network_fetch', 
                        url, 
                        retryAttempts: this.retryAttempts 
                    });
                    throw error;
                }
                
                // Wait before retrying (exponential backoff)
                await this.delay(Math.pow(2, this.retryAttempts) * 1000);
            }
        }
    }

    /**
     * Delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset retry attempts
     */
    reset() {
        this.retryAttempts = 0;
    }
}

// Initialize error handling when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ErrorHandler = ErrorHandler;
    window.FormErrorHandler = FormErrorHandler;
    window.NetworkErrorHandler = NetworkErrorHandler;
    
    // Initialize global error handler
    window.errorHandler = new ErrorHandler();
    window.formErrorHandler = new FormErrorHandler();
    window.networkErrorHandler = new NetworkErrorHandler();
});

// Export for use in other modules
window.ErrorHandler = ErrorHandler;
window.FormErrorHandler = FormErrorHandler;
window.NetworkErrorHandler = NetworkErrorHandler;
