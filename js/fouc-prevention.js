/**
 * FOUC Prevention Utility
 * Prevents Flash of Unstyled Content across all pages
 */

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
        }, 2000);
        
        // Check resources and show content when ready
        this.checkResourcesLoaded().then(() => {
            clearTimeout(this.loadTimeout);
            setTimeout(() => this.showContent(), 100);
        }).catch(() => {
            clearTimeout(this.loadTimeout);
            this.showContent();
        });
        
        // Also show content when window load event fires
        window.addEventListener('load', () => {
            clearTimeout(this.loadTimeout);
            setTimeout(() => this.showContent(), 100);
        });
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
                }, 100);
                
                // Timeout after 3 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve(); // Continue anyway
                }, 3000);
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
                    setTimeout(resolve, 500);
                }
            };
            
            // Check after a short delay to allow font loading
            setTimeout(checkFont, 100);
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