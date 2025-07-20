document.addEventListener('DOMContentLoaded', () => {
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
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Welcome Modal Logic (only on homepage)
    const modal = document.getElementById('welcomeModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const exploreButton = document.getElementById('exploreButton');
    const body = document.body;

    if (modal) {
        // Function to open the modal
        const openModal = () => {
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                body.classList.add('modal-open');
            }, 10); // Short delay to allow display property to apply before transition
        };

        // Function to close the modal
        const closeModal = () => {
            modal.classList.add('opacity-0');
            body.classList.remove('modal-open');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300); // Wait for transition to finish
            
            // Set a flag in localStorage so the modal doesn't show again
            try {
                localStorage.setItem('brumOutloudVisited', 'true');
            } catch (e) {
                console.error("LocalStorage is not available.", e);
            }
        };

        // Check if the user has visited before
        const hasVisited = localStorage.getItem('brumOutloudVisited');

        if (!hasVisited) {
            // If it's the first visit, show the modal after a short delay
            setTimeout(openModal, 1000);
        }

        // Event listeners to close the modal
        if (closeModalButton) {
            closeModalButton.addEventListener('click', closeModal);
        }
        if (exploreButton) {
            exploreButton.addEventListener('click', closeModal);
        }

        // Close modal when clicking outside of it
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                closeModal();
            }
        });
    }

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
    
    // Global error handling for forms
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
        // Don't show error to user unless it's critical
    });
    
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
    
    // Load header and footer content
    const loadHeaderFooter = async () => {
        try {
            // Load header
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                const headerResponse = await fetch('/global/header.html');
                if (headerResponse.ok) {
                    const headerContent = await headerResponse.text();
                    headerPlaceholder.innerHTML = headerContent;
                    
                    // Reinitialize mobile menu after header is loaded
                    setTimeout(() => {
                        initializeMobileMenu();
                    }, 100);
                }
            }
            
            // Load footer
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                const footerResponse = await fetch('/global/footer.html');
                if (footerResponse.ok) {
                    const footerContent = await footerResponse.text();
                    footerPlaceholder.innerHTML = footerContent;
                }
            }
        } catch (error) {
            console.error('Error loading header/footer:', error);
        }
    };
    
    // Load header and footer
    loadHeaderFooter();
});
