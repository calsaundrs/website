/**
 * Accessibility Enhancement System
 * Phase 3: Accessibility & Usability
 */

class AccessibilityManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupSkipLinks();
        this.setupARIALabels();
        this.setupLiveRegions();
        this.setupReducedMotion();
        this.setupHighContrast();
    }

    /**
     * Enhanced Keyboard Navigation
     */
    setupKeyboardNavigation() {
        // Tab order optimization
        this.optimizeTabOrder();
        
        // Keyboard shortcuts for power users
        this.setupKeyboardShortcuts();
        
        // Enhanced focus indicators
        this.enhanceFocusIndicators();
        
        // Escape key handlers
        this.setupEscapeHandlers();
    }

    optimizeTabOrder() {
        // Ensure logical tab order for forms
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input, textarea, select, button, a[href]');
            inputs.forEach((input, index) => {
                input.setAttribute('tabindex', index + 1);
            });
        });

        // Ensure navigation has proper tab order
        const nav = document.querySelector('nav');
        if (nav) {
            const navItems = nav.querySelectorAll('a, button');
            navItems.forEach((item, index) => {
                item.setAttribute('tabindex', index + 1);
            });
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Skip if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Alt + H: Go to homepage
            if (e.altKey && e.key === 'h') {
                e.preventDefault();
                window.location.href = '/';
            }

            // Alt + E: Go to events
            if (e.altKey && e.key === 'e') {
                e.preventDefault();
                window.location.href = '/events.html';
            }

            // Alt + V: Go to venues
            if (e.altKey && e.key === 'v') {
                e.preventDefault();
                window.location.href = '/all-venues.html';
            }

            // Alt + S: Submit event
            if (e.altKey && e.key === 's') {
                e.preventDefault();
                window.location.href = '/promoter-tool.html';
            }

            // Alt + M: Toggle mobile menu
            if (e.altKey && e.key === 'm') {
                e.preventDefault();
                const menuBtn = document.getElementById('menu-btn');
                if (menuBtn) menuBtn.click();
            }

            // Alt + F: Focus search/filter
            if (e.altKey && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.querySelector('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]');
                if (searchInput) searchInput.focus();
            }
        });
    }

    enhanceFocusIndicators() {
        // Add enhanced focus styles
        const style = document.createElement('style');
        style.textContent = `
            *:focus-visible {
                outline: 3px solid #E83A99 !important;
                outline-offset: 2px !important;
                border-radius: 4px !important;
                transition: outline 0.2s ease !important;
            }
            
            .btn:focus-visible,
            .filter-button:focus-visible,
            .nav-link:focus-visible {
                outline: 3px solid #E83A99 !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 0 2px rgba(232, 58, 153, 0.2) !important;
            }
            
            /* High contrast mode */
            @media (prefers-contrast: high) {
                *:focus-visible {
                    outline: 4px solid #FFFFFF !important;
                    outline-offset: 1px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupEscapeHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close mobile menu
                const menu = document.getElementById('menu');
                if (menu && !menu.classList.contains('hidden')) {
                    const menuBtn = document.getElementById('menu-btn');
                    if (menuBtn) menuBtn.click();
                }

                // Close modals
                const modals = document.querySelectorAll('.modal-overlay, .mobile-filter-modal');
                modals.forEach(modal => {
                    if (!modal.classList.contains('hidden')) {
                        const closeBtn = modal.querySelector('[onclick*="close"], .btn-close');
                        if (closeBtn) closeBtn.click();
                    }
                });

                // Close dropdowns
                const dropdowns = document.querySelectorAll('.dropdown, .filter-dropdown');
                dropdowns.forEach(dropdown => {
                    if (dropdown.classList.contains('open')) {
                        dropdown.classList.remove('open');
                    }
                });
            }
        });
    }

    /**
     * Focus Management
     */
    setupFocusManagement() {
        // Trap focus in modals
        this.setupFocusTrapping();
        
        // Return focus after modal closes
        this.setupFocusReturn();
        
        // Focus first interactive element in new content
        this.setupAutoFocus();
    }

    setupFocusTrapping() {
        // Focus trap for modals
        const modals = document.querySelectorAll('.modal-overlay, .mobile-filter-modal');
        modals.forEach(modal => {
            const focusableElements = modal.querySelectorAll(
                'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
            );
            
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    if (e.shiftKey) {
                        if (document.activeElement === firstElement) {
                            e.preventDefault();
                            lastElement.focus();
                        }
                    } else {
                        if (document.activeElement === lastElement) {
                            e.preventDefault();
                            firstElement.focus();
                        }
                    }
                }
            });
        });
    }

    setupFocusReturn() {
        // Store focused element before opening modal
        let previouslyFocusedElement = null;

        // Store focus when opening modals
        document.addEventListener('click', (e) => {
            if (e.target.matches('[onclick*="open"], .btn-menu')) {
                previouslyFocusedElement = document.activeElement;
            }
        });

        // Return focus when closing modals
        document.addEventListener('click', (e) => {
            if (e.target.matches('[onclick*="close"], .btn-close')) {
                setTimeout(() => {
                    if (previouslyFocusedElement) {
                        previouslyFocusedElement.focus();
                        previouslyFocusedElement = null;
                    }
                }, 100);
            }
        });
    }

    setupAutoFocus() {
        // Focus first interactive element in new content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const firstFocusable = node.querySelector(
                                'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
                            );
                            if (firstFocusable && !document.activeElement) {
                                firstFocusable.focus();
                            }
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Skip Links - Removed as requested
     */
    setupSkipLinks() {
        // Skip links removed - keeping IDs for potential future use
        const main = document.querySelector('main');
        if (main) main.id = 'main-content';

        const nav = document.querySelector('nav');
        if (nav) nav.id = 'main-navigation';
    }

    /**
     * ARIA Labels and Descriptions
     */
    setupARIALabels() {
        // Add missing ARIA labels
        this.addMissingARIALabels();
        
        // Enhance existing ARIA labels
        this.enhanceARIALabels();
        
        // Add descriptions for complex elements
        this.addARIADescriptions();
    }

    addMissingARIALabels() {
        // Buttons without text
        const iconButtons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
        iconButtons.forEach(button => {
            const icon = button.querySelector('i');
            if (icon) {
                const iconClass = icon.className;
                let label = 'Button';
                
                if (iconClass.includes('fa-bars')) label = 'Open menu';
                if (iconClass.includes('fa-times')) label = 'Close';
                if (iconClass.includes('fa-filter')) label = 'Apply filters';
                if (iconClass.includes('fa-arrow-left')) label = 'Go back';
                if (iconClass.includes('fa-arrow-right')) label = 'Go forward';
                if (iconClass.includes('fa-search')) label = 'Search';
                if (iconClass.includes('fa-download')) label = 'Download';
                
                button.setAttribute('aria-label', label);
            }
        });

        // Form inputs without labels
        const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
        inputs.forEach(input => {
            const placeholder = input.placeholder;
            const name = input.name;
            const type = input.type;
            
            if (placeholder) {
                input.setAttribute('aria-label', placeholder);
            } else if (name) {
                input.setAttribute('aria-label', name.replace(/([A-Z])/g, ' $1').toLowerCase());
            } else if (type) {
                input.setAttribute('aria-label', type.charAt(0).toUpperCase() + type.slice(1));
            }
        });
    }

    enhanceARIALabels() {
        // Add role attributes
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (!button.getAttribute('role')) {
                button.setAttribute('role', 'button');
            }
        });

        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            if (!link.getAttribute('role')) {
                link.setAttribute('role', 'link');
            }
        });

        // Add state attributes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.setAttribute('role', 'checkbox');
            checkbox.setAttribute('aria-checked', checkbox.checked);
        });
    }

    addARIADescriptions() {
        // Add descriptions for complex forms
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (!form.getAttribute('aria-describedby')) {
                const description = form.querySelector('.form-description, .help-text');
                if (description) {
                    const id = 'form-description-' + Math.random().toString(36).substr(2, 9);
                    description.id = id;
                    form.setAttribute('aria-describedby', id);
                }
            }
        });
    }

    /**
     * Live Regions for Dynamic Content
     */
    setupLiveRegions() {
        // Add live region for form submissions
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);

        // Announce form submission status
        document.addEventListener('formSubmission', (e) => {
            const message = e.detail.success ? 
                'Form submitted successfully' : 
                'Form submission failed: ' + e.detail.error;
            liveRegion.textContent = message;
        });

        // Announce filter changes
        document.addEventListener('filterChange', (e) => {
            const count = e.detail.count;
            const message = `Showing ${count} events`;
            liveRegion.textContent = message;
        });
    }

    /**
     * Reduced Motion Support
     */
    setupReducedMotion() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        if (prefersReducedMotion.matches) {
            this.disableAnimations();
        }

        prefersReducedMotion.addEventListener('change', (e) => {
            if (e.matches) {
                this.disableAnimations();
            } else {
                this.enableAnimations();
            }
        });
    }

    disableAnimations() {
        document.body.classList.add('reduced-motion');
        
        const style = document.createElement('style');
        style.textContent = `
            .reduced-motion *,
            .reduced-motion *::before,
            .reduced-motion *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
        `;
        document.head.appendChild(style);
    }

    enableAnimations() {
        document.body.classList.remove('reduced-motion');
    }

    /**
     * High Contrast Mode Support
     */
    setupHighContrast() {
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
        
        if (prefersHighContrast.matches) {
            this.enableHighContrast();
        }

        prefersHighContrast.addEventListener('change', (e) => {
            if (e.matches) {
                this.enableHighContrast();
            } else {
                this.disableHighContrast();
            }
        });
    }

    enableHighContrast() {
        document.body.classList.add('high-contrast');
        
        const style = document.createElement('style');
        style.textContent = `
            .high-contrast {
                --text-color: #FFFFFF !important;
                --bg-color: #000000 !important;
                --accent-color: #FFFF00 !important;
                --border-color: #FFFFFF !important;
            }
            
            .high-contrast * {
                color: var(--text-color) !important;
                background-color: var(--bg-color) !important;
                border-color: var(--border-color) !important;
            }
            
            .high-contrast .btn-primary {
                background-color: var(--accent-color) !important;
                color: #000000 !important;
            }
        `;
        document.head.appendChild(style);
    }

    disableHighContrast() {
        document.body.classList.remove('high-contrast');
    }
}

// Initialize accessibility features when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AccessibilityManager();
});

// Export for use in other modules
window.AccessibilityManager = AccessibilityManager;
