// Main application logic
document.addEventListener('DOMContentLoaded', () => {
    // FOUC prevention is handled by fouc-prevention.js
    // Wait for content to be loaded before initializing other features
    const initializeApp = () => {
        // Fix pride flag flashing issue
        const fixPrideFlagFlash = () => {
            // Add flag-loaded class to body after a short delay to ensure CSS is loaded
            setTimeout(() => {
                document.body.classList.add('flag-loaded');
            }, 100);
            
            // Also add it immediately for fast connections
            document.body.classList.add('flag-loaded');
        };
        
        // Run the fix
        fixPrideFlagFlash();
        
        // Initialize other features...
        initializeMobileMenu();
        initializeFormHandling();
    };
    
    // Initialize immediately if FOUC prevention is not active
    if (!document.body.classList.contains('fouc-prevention') || document.body.classList.contains('loaded')) {
        initializeApp();
    } else {
        // Wait for FOUC prevention to complete
        window.addEventListener('foucContentLoaded', initializeApp);
    }
    
    // Enhanced Mobile menu functionality with accessibility
    
    // Enhanced Mobile menu functionality with accessibility
    const initializeMobileMenu = () => {
        const menuBtn = document.getElementById('menu-btn');
        const menu = document.getElementById('menu');
        
        if (!menuBtn || !menu) return;
        
        let isMenuOpen = false;
        
        const openMenu = () => {
            menu.classList.remove('hidden');
            menu.classList.add('flex');
            menuBtn.setAttribute('aria-expanded', 'true');
            menuBtn.innerHTML = '<i class="fas fa-times"></i>';
            document.body.style.overflow = 'hidden'; // Prevent scroll
            isMenuOpen = true;
            
            // Focus first menu item for accessibility
            const firstMenuItem = menu.querySelector('a');
            if (firstMenuItem) firstMenuItem.focus();
        };
        
        const closeMenu = () => {
            menu.classList.add('hidden');
            menu.classList.remove('flex');
            menuBtn.setAttribute('aria-expanded', 'false');
            menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            document.body.style.overflow = ''; // Restore scroll
            isMenuOpen = false;
        };
        
        const toggleMenu = () => {
            if (isMenuOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        };
        
        // Click handler
        menuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMenu();
        });
        
        // Close menu when clicking on a menu item
        menu.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                closeMenu();
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (isMenuOpen && !menu.contains(e.target) && !menuBtn.contains(e.target)) {
                closeMenu();
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isMenuOpen) {
                closeMenu();
                menuBtn.focus();
            }
        });
        
        // Initialize ARIA attributes
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-controls', 'menu');
        menuBtn.setAttribute('aria-label', 'Toggle navigation menu');
        menu.setAttribute('role', 'navigation');
        menu.setAttribute('aria-hidden', 'true');
    };
    

    
    // Form handling and validation
    const initializeFormHandling = () => {
        // Handle form validation errors
        const handleFormErrors = (form) => {
            if (!form) return;
            
            form.addEventListener('submit', (e) => {
                const requiredFields = form.querySelectorAll('[required]');
                let hasErrors = false;
                
                requiredFields.forEach(field => {
                    if (!field.value.trim()) {
                        field.classList.add('border-red-500');
                        hasErrors = true;
                    } else {
                        field.classList.remove('border-red-500');
                    }
                });
                
                if (hasErrors) {
                    e.preventDefault();
                    const firstError = form.querySelector('.border-red-500');
                    if (firstError) {
                        firstError.focus();
                        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            });
        };
        
        // Apply form validation to all forms
        document.querySelectorAll('form').forEach(handleFormErrors);
    };

    // Register Service Worker with error handling
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New version available
                                if (confirm('A new version of the site is available. Refresh to update?')) {
                                    window.location.reload();
                                }
                            }
                        });
                    });
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
    
    // Global error handling
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
        // Don't show error to user unless it's critical
    });
});
