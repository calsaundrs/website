/**
 * FOUC Prevention Utility
 * Prevents Flash of Unstyled Content across all pages
 */

// Immediately hide content to prevent FOUC
(function() {
    'use strict';
    
    try {
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
        console.log('FOUC Prevention: Critical CSS injected');
    } catch (error) {
        console.error('FOUC Prevention: Error injecting critical CSS:', error);
    }
})();

class FOUCPrevention {
    constructor() {
        try {
            this.body = document.body;
            this.loadingScreen = document.getElementById('loadingScreen');
            this.isContentShown = false;
            this.init();
        } catch (error) {
            console.error('FOUC Prevention: Error in constructor:', error);
            this.emergencyShow();
        }
    }
    
    init() {
        try {
            // Add FOUC prevention class to body if not already present
            if (!this.body.classList.contains('fouc-prevention')) {
                this.body.classList.add('fouc-prevention');
            }
            
            // Start the loading process
            this.startLoading();
        } catch (error) {
            console.error('FOUC Prevention: Error in init:', error);
            this.emergencyShow();
        }
    }
    
    startLoading() {
        try {
            console.log('FOUC Prevention: Starting loading process');
            
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
                console.log('FOUC Prevention: Trigger fired, showing content');
                setTimeout(() => this.showContent(), 100);
            }).catch(error => {
                console.error('FOUC Prevention: Error in triggers:', error);
                this.showContent();
            });
            
            // Additional safety timeout
            setTimeout(() => {
                console.log('FOUC Prevention: Safety timeout triggered');
                this.showContent();
            }, 2000);
            
        } catch (error) {
            console.error('FOUC Prevention: Error in startLoading:', error);
            this.emergencyShow();
        }
    }
    
    showContent() {
        try {
            if (this.isContentShown) {
                console.log('FOUC Prevention: Content already shown');
                return;
            }
            
            console.log('FOUC Prevention: Showing content');
            this.isContentShown = true;
            
            // Add loaded class to html and body
            document.documentElement.classList.add('loaded');
            this.body.classList.add('loaded');
            
            // Hide loading screen with animation
            if (this.loadingScreen) {
                console.log('FOUC Prevention: Hiding loading screen');
                this.loadingScreen.classList.add('hidden');
                
                // Remove loading screen from DOM after animation
                setTimeout(() => {
                    if (this.loadingScreen && this.loadingScreen.parentNode) {
                        this.loadingScreen.parentNode.removeChild(this.loadingScreen);
                        console.log('FOUC Prevention: Loading screen removed from DOM');
                    }
                }, 500);
            } else {
                console.log('FOUC Prevention: No loading screen found');
            }
            
            // Trigger custom event for other scripts
            window.dispatchEvent(new CustomEvent('foucContentLoaded'));
            
            console.log('FOUC Prevention: Content shown successfully');
            
        } catch (error) {
            console.error('FOUC Prevention: Error in showContent:', error);
            this.emergencyShow();
        }
    }
    
    emergencyShow() {
        try {
            console.log('FOUC Prevention: Emergency show triggered');
            document.documentElement.classList.add('loaded');
            this.body.classList.add('loaded');
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
            }
        } catch (error) {
            console.error('FOUC Prevention: Error in emergency show:', error);
        }
    }
    
    // Public method to manually show content
    forceShowContent() {
        console.log('FOUC Prevention: Force show requested');
        this.showContent();
    }
}

// Auto-initialize
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('FOUC Prevention: DOM ready, initializing');
            window.foucPrevention = new FOUCPrevention();
        });
    } else {
        console.log('FOUC Prevention: DOM already ready, initializing immediately');
        window.foucPrevention = new FOUCPrevention();
    }
} catch (error) {
    console.error('FOUC Prevention: Error in auto-initialization:', error);
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