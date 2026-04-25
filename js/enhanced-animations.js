/**
 * Enhanced Animations & Micro-interactions
 * Phase 2: Visual Polish & UX
 */

class EnhancedAnimations {
    constructor() {
        this.init();
    }

    init() {
        this.setupLoadingScreen();
        this.setupPageTransitions();
        this.setupStaggeredAnimations();
        this.setupScrollReveals();
        this.setupIntersectionObserver();
        this.setupSmoothScrolling();
        this.setupTouchInteractions();
    }

    /**
     * Enhanced Loading Screen with smooth fade-out
     */
    setupLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) return;

        // Hide loading screen after page loads
        window.addEventListener('load', () => {
            setTimeout(() => {
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 1000);
        });

        // Fallback: hide after 3 seconds if load event doesn't fire
        setTimeout(() => {
            if (loadingScreen && !loadingScreen.classList.contains('fade-out')) {
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 3000);
    }

    /**
     * Setup scroll-triggered animations
     */
    setupScrollReveals() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                }
            });
        }, observerOptions);

        // Observe all elements with scroll-reveal class
        document.querySelectorAll('.scroll-reveal').forEach(el => {
            observer.observe(el);
        });
    }

    /**
     * Setup page transition animations
     */
    setupPageTransitions() {
        const pageContent = document.querySelector('main, .main-content, .container');
        if (!pageContent) return;

        // Add page-transition class
        pageContent.classList.add('page-transition');

        // Trigger loaded animation after a short delay
        setTimeout(() => {
            pageContent.classList.add('loaded');
        }, 100);
    }

    /**
     * Setup staggered animations for cards
     */
    setupStaggeredAnimations() {
        const cards = document.querySelectorAll('.feature-card, .venue-card');
        
        cards.forEach((card, index) => {
            // Add staggered delay
            card.style.animationDelay = `${index * 0.1}s`;
            
            // Add scroll-reveal class for intersection observer
            card.classList.add('scroll-reveal');
        });
    }

    /**
     * Setup intersection observer for performance
     */
    setupIntersectionObserver() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Add animation classes when elements come into view
                    entry.target.classList.add('animate-in');
                    
                    // Unobserve after animation
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe elements that should animate on scroll
        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }

    /**
     * Setup smooth scrolling for anchor links
     */
    setupSmoothScrolling() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    /**
     * Setup enhanced touch interactions for mobile
     */
    setupTouchInteractions() {
        if ('ontouchstart' in window) {
            // Add touch-specific classes
            document.body.classList.add('touch-device');
            
            // Enhanced touch feedback
            document.querySelectorAll('.btn, .filter-button, .nav-link').forEach(el => {
                el.addEventListener('touchstart', () => {
                    el.classList.add('touch-active');
                });
                
                el.addEventListener('touchend', () => {
                    setTimeout(() => {
                        el.classList.remove('touch-active');
                    }, 150);
                });
            });
        }
    }

    /**
     * Add loading states to buttons
     */
    static addLoadingState(button, text = 'Loading...') {
        const originalText = button.innerHTML;
        button.innerHTML = `
            <span class="loading-spinner-small"></span>
            <span>${text}</span>
        `;
        button.disabled = true;
        button.classList.add('loading-state');
        
        return () => {
            button.innerHTML = originalText;
            button.disabled = false;
            button.classList.remove('loading-state');
        };
    }

    /**
     * Add success/error feedback
     */
    static showFeedback(message, type = 'success') {
        const feedback = document.createElement('div');
        feedback.className = `feedback-message feedback-${type}`;
        feedback.textContent = message;
        
        document.body.appendChild(feedback);
        
        // Animate in
        setTimeout(() => feedback.classList.add('show'), 10);
        
        // Remove after delay
        setTimeout(() => {
            feedback.classList.remove('show');
            setTimeout(() => feedback.remove(), 300);
        }, 3000);
    }

    /**
     * Parallax effect for background elements
     */
    setupParallax() {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.parallax');
            
            parallaxElements.forEach(element => {
                const speed = element.dataset.speed || 0.5;
                const yPos = -(scrolled * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        });
    }
}

/**
 * Enhanced Form Interactions
 */
class EnhancedForms {
    constructor() {
        this.setupFormAnimations();
        this.setupValidationFeedback();
    }

    setupFormAnimations() {
        document.querySelectorAll('input, textarea, select').forEach(field => {
            // Add floating label effect
            if (field.value) {
                field.classList.add('has-value');
            }
            
            field.addEventListener('focus', () => {
                field.classList.add('focused');
            });
            
            field.addEventListener('blur', () => {
                field.classList.remove('focused');
                if (field.value) {
                    field.classList.add('has-value');
                } else {
                    field.classList.remove('has-value');
                }
            });
            
            field.addEventListener('input', () => {
                if (field.value) {
                    field.classList.add('has-value');
                } else {
                    field.classList.remove('has-value');
                }
            });
        });
    }

    setupValidationFeedback() {
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    const removeLoading = EnhancedAnimations.addLoadingState(submitButton, 'Submitting...');
                    
                    // Simulate form submission (replace with actual logic)
                    setTimeout(() => {
                        removeLoading();
                        EnhancedAnimations.showFeedback('Form submitted successfully!', 'success');
                    }, 2000);
                }
            });
        });
    }
}

/**
 * Enhanced Navigation
 */
class EnhancedNavigation {
    constructor() {
        this.setupMobileMenu();
        this.setupScrollEffects();
    }

    setupMobileMenu() {
        const menuButton = document.getElementById('menu-btn');
        const menu = document.getElementById('menu');
        
        if (menuButton && menu) {
            menuButton.addEventListener('click', () => {
                menu.classList.toggle('hidden');
                menu.classList.toggle('flex');
                
                // Animate menu items
                const menuItems = menu.querySelectorAll('a');
                menuItems.forEach((item, index) => {
                    if (menu.classList.contains('flex')) {
                        item.style.animationDelay = `${index * 0.1}s`;
                        item.classList.add('menu-item-enter');
                    } else {
                        item.classList.remove('menu-item-enter');
                    }
                });
            });
        }
    }

    setupScrollEffects() {
        const header = document.querySelector('header');
        if (!header) return;

        let lastScroll = 0;
        
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > lastScroll && currentScroll > 100) {
                // Scrolling down
                header.classList.add('header-hidden');
            } else {
                // Scrolling up
                header.classList.remove('header-hidden');
            }
            
            if (currentScroll > 50) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
            
            lastScroll = currentScroll;
        });
    }
}

// Initialize enhanced animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedAnimations();
    new EnhancedForms();
    new EnhancedNavigation();
});

// Export for use in other modules
window.EnhancedAnimations = EnhancedAnimations;
window.EnhancedForms = EnhancedForms;
window.EnhancedNavigation = EnhancedNavigation;
