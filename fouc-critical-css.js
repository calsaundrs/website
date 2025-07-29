/**
 * Critical CSS Injection for FOUC Prevention
 * Injects CSS that prevents FOUC even if JavaScript fails
 */

const criticalCSS = `
/* FOUC Prevention - Critical CSS */
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

/* Loading screen */
.loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #121212 0%, #1a1a1a 50%, #2d1b69 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    transition: opacity 0.5s ease, visibility 0.5s ease;
}

.loading-screen.hidden {
    opacity: 0;
    visibility: hidden;
}

.loading-logo {
    width: 80px;
    height: 80px;
    margin-bottom: 20px;
    animation: pulse 2s infinite;
}

.loading-text {
    color: #B564F7;
    font-family: 'Poppins', sans-serif;
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 10px;
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(181, 100, 247, 0.3);
    border-top: 3px solid #B564F7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Critical CSS to prevent flashing */
body {
    background-color: #121212;
    color: #EAEAEA;
    font-family: 'Poppins', system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    margin: 0;
    padding: 0;
}

/* Basic layout styles to prevent layout shift */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
}

/* Prevent pride flag from flashing at full size */
img[src*="progressflag"] {
    height: 1.5rem !important;
    width: auto !important;
    max-width: 1.5rem !important;
    opacity: 0;
    transition: opacity 0.3s ease;
}

/* Show flag after page loads */
.flag-loaded img[src*="progressflag"] {
    opacity: 1;
}
`;

/**
 * Inject critical CSS into the document head
 */
function injectCriticalCSS() {
    // Check if already injected
    if (document.querySelector('#fouc-critical-css')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'fouc-critical-css';
    style.textContent = criticalCSS;
    
    // Insert at the very beginning of head
    if (document.head.firstChild) {
        document.head.insertBefore(style, document.head.firstChild);
    } else {
        document.head.appendChild(style);
    }
}

/**
 * Show content when ready
 */
function showContent() {
    document.documentElement.classList.add('loaded');
    document.body.classList.add('loaded');
}

/**
 * Initialize FOUC prevention
 */
function initFOUCPrevention() {
    // Inject critical CSS immediately
    injectCriticalCSS();
    
    // Show content when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(showContent, 100);
        });
    } else {
        setTimeout(showContent, 100);
    }
    
    // Also show on window load
    window.addEventListener('load', () => {
        setTimeout(showContent, 50);
    });
    
    // Fallback timeout
    setTimeout(showContent, 1500);
}

// Run immediately
initFOUCPrevention();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        injectCriticalCSS,
        showContent,
        initFOUCPrevention,
        criticalCSS
    };
}