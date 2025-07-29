/**
 * FOUC Prevention Utility
 * Prevents Flash of Unstyled Content across all pages
 */

// Immediately hide content to prevent FOUC
(function() {
    'use strict';
    
    // Add critical CSS immediately
    const criticalStyle = document.createElement('style');
    criticalStyle.textContent = `
        html {
            visibility: hidden;
        }
        html.loaded {
            visibility: visible;
        }
        body {
            visibility: hidden !important;
            opacity: 0 !important;
            transition: opacity 0.3s ease, visibility 0.3s ease !important;
        }
        body.loaded {
            visibility: visible !important;
            opacity: 1 !important;
        }
        .fouc-prevention {
            visibility: hidden;
            opacity: 0;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        .fouc-prevention.loaded {
            visibility: visible;
            opacity: 1;
        }
    `;
    document.head.insertBefore(criticalStyle, document.head.firstChild);
})();

class FOUCPrevention {
    constructor() {
        this.body = document.body;
        this.loadingScreen = document.getElementById('loadingScreen');
        this.isContentShown = false;
        this.init();
    }
    
    init() {
        // Add FOUC prevention class to body if not already present
        if (!this.body.classList.contains('fouc-prevention')) {
            this.body.classList.add('fouc-prevention');
        }
        
        // Start the loading process
        this.startLoading();
    }
    
    startLoading() {
        // Multiple triggers to ensure content shows
        const triggers = [
            // DOM ready
            new Promise(resolve => {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', resolve);
                } else {
                    resolve();
                }
            }),
            
            // Window load
            new Promise(resolve => {
                window.addEventListener('load', resolve);
            }),
            
            // Fallback timeout
            new Promise(resolve => {
                setTimeout(resolve, 1000);
            })
        ];
        
        // Show content when any trigger fires
        Promise.race(triggers).then(() => {
            setTimeout(() => this.showContent(), 100);
        });
        
        // Additional safety timeout
        setTimeout(() => {
            this.showContent();
        }, 2000);
    }
    
    showContent() {
        if (this.isContentShown) return;
        
        this.isContentShown = true;
        
        // Add loaded class to html and body
        document.documentElement.classList.add('loaded');
        this.body.classList.add('loaded');
        
        // Hide loading screen with animation
        if (this.loadingScreen) {
            this.loadingScreen.classList.add('hidden');
            
            // Remove loading screen from DOM after animation
            setTimeout(() => {
                if (this.loadingScreen && this.loadingScreen.parentNode) {
                    this.loadingScreen.parentNode.removeChild(this.loadingScreen);
                }
            }, 500);
        }
        
        // Trigger custom event for other scripts
        window.dispatchEvent(new CustomEvent('foucContentLoaded'));
        
        // Debug logging
        console.log('FOUC Prevention: Content shown');
    }
    
    // Public method to manually show content
    forceShowContent() {
        this.showContent();
    }
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.foucPrevention = new FOUCPrevention();
    });
} else {
    window.foucPrevention = new FOUCPrevention();
}

// Emergency fallback - show content after 3 seconds no matter what
setTimeout(() => {
    console.log('FOUC Prevention: Emergency fallback triggered');
    if (window.foucPrevention) {
        window.foucPrevention.forceShowContent();
    } else {
        document.documentElement.classList.add('loaded');
        document.body.classList.add('loaded');
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }
}, 3000);

// Manual override for debugging
window.forceFOUCShow = function() {
    console.log('FOUC Prevention: Manual override triggered');
    if (window.foucPrevention) {
        window.foucPrevention.forceShowContent();
    } else {
        document.documentElement.classList.add('loaded');
        document.body.classList.add('loaded');
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FOUCPrevention;
}