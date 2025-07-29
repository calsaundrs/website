/**
 * FOUC Prevention Utility
 * Prevents Flash of Unstyled Content across all pages
 */

// Immediately hide content to prevent FOUC
(function() {
    'use strict';
    
    // Hide content immediately if not already hidden
    if (document.body && !document.body.classList.contains('loaded')) {
        document.body.style.visibility = 'hidden';
        document.body.style.opacity = '0';
    }
    
    // Also hide any existing content
    const style = document.createElement('style');
    style.textContent = `
        body:not(.loaded) {
            visibility: hidden !important;
            opacity: 0 !important;
        }
        body.loaded {
            visibility: visible !important;
            opacity: 1 !important;
            transition: opacity 0.3s ease, visibility 0.3s ease !important;
        }
    `;
    document.head.appendChild(style);
})();

class FOUCPrevention {
    constructor() {
        this.body = document.body;
        this.loadingScreen = document.getElementById('loadingScreen');
        this.loadTimeout = null;
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
        // Set fallback timeout
        this.loadTimeout = setTimeout(() => {
            this.showContent();
        }, 1500); // Reduced timeout for faster loading
        
        // Check resources and show content when ready
        this.checkResourcesLoaded().then(() => {
            clearTimeout(this.loadTimeout);
            setTimeout(() => this.showContent(), 50);
        }).catch(() => {
            clearTimeout(this.loadTimeout);
            this.showContent();
        });
        
        // Also show content when window load event fires
        window.addEventListener('load', () => {
            clearTimeout(this.loadTimeout);
            setTimeout(() => this.showContent(), 50);
        });
        
        // Show content when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.showContent(), 100);
            });
        } else {
            setTimeout(() => this.showContent(), 100);
        }
    }
    
    checkResourcesLoaded() {
        const checks = [];
        
        // Check if main CSS is loaded
        const mainCSSLink = document.querySelector('link[href*="main.css"]');
        if (mainCSSLink) {
            checks.push(this.checkCSSLoaded(mainCSSLink));
        }
        
        // Check if fonts are loaded
        if (document.fonts && document.fonts.ready) {
            checks.push(document.fonts.ready);
        }
        
        // Check if Tailwind is loaded
        const tailwindScript = document.querySelector('script[src*="tailwindcss"]');
        if (tailwindScript) {
            checks.push(this.checkTailwindLoaded());
        }
        
        // Check if custom fonts are loaded
        checks.push(this.checkCustomFontsLoaded());
        
        return Promise.all(checks);
    }
    
    checkCSSLoaded(linkElement) {
        return new Promise((resolve) => {
            if (linkElement.sheet !== null) {
                resolve();
            } else {
                linkElement.addEventListener('load', resolve);
                linkElement.addEventListener('error', resolve); // Continue even if CSS fails
            }
        });
    }
    
    checkTailwindLoaded() {
        return new Promise((resolve) => {
            if (window.tailwind) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.tailwind) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 50); // Faster checking
                
                // Timeout after 2 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(); // Continue anyway
                }, 2000);
            }
        });
    }
    
    checkCustomFontsLoaded() {
        return new Promise((resolve) => {
            // Check for Omnes Pro font
            const testString = 'Test';
            const testElement = document.createElement('span');
            testElement.style.fontFamily = 'Omnes Pro, sans-serif';
            testElement.style.fontSize = '72px';
            testElement.style.position = 'absolute';
            testElement.style.visibility = 'hidden';
            testElement.textContent = testString;
            
            document.body.appendChild(testElement);
            
            const checkFont = () => {
                const width = testElement.offsetWidth;
                document.body.removeChild(testElement);
                
                // If width is significantly different from default, font is loaded
                if (width > 100) {
                    resolve();
                } else {
                    // Try again after a short delay
                    setTimeout(resolve, 200);
                }
            };
            
            // Check after a short delay to allow font loading
            setTimeout(checkFont, 50);
        });
    }
    
    showContent() {
        if (this.isContentShown) return;
        
        this.isContentShown = true;
        
        // Add loaded class to body
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
    }
    
    // Public method to manually show content
    forceShowContent() {
        this.showContent();
    }
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.foucPrevention = new FOUCPrevention();
    });
} else {
    window.foucPrevention = new FOUCPrevention();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FOUCPrevention;
}