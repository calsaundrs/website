/**
 * SEO & Social Media Manager
 * Phase 5: Advanced Features & Polish
 */

class SEOManager {
    constructor() {
        this.defaultMeta = {
            title: 'Brum Outloud - LGBTQ+ Birmingham Guide',
            description: 'Your essential guide to Birmingham\'s vibrant LGBTQ+ scene. Discover queer-friendly events, venues, and community resources for residents and visitors.',
            keywords: 'LGBTQ+, Birmingham, queer events, gay bars, lesbian venues, transgender friendly, Birmingham Pride, queer community',
            image: 'https://brumoutloud.co.uk/progressflag.svg.png',
            url: 'https://brumoutloud.co.uk',
            type: 'website',
            siteName: 'Brum Outloud',
            twitterHandle: '@brumoutloud'
        };
        this.init();
    }

    init() {
        this.setupDynamicMeta();
        this.setupStructuredData();
        this.setupSocialSharing();
        this.setupAnalytics();
    }

    /**
     * Setup dynamic meta tags based on page content
     */
    setupDynamicMeta() {
        const page = this.getCurrentPage();
        const meta = this.getPageMeta(page);
        
        this.updateMetaTags(meta);
        this.updateOpenGraph(meta);
        this.updateTwitterCard(meta);
    }

    /**
     * Get current page information
     */
    getCurrentPage() {
        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        
        return {
            path,
            isHome: path === '/' || path === '/index.html',
            isEvents: path === '/events.html',
            isVenues: path === '/all-venues.html',
            isSubmit: path === '/promoter-tool.html',
            isCommunity: path === '/community.html',
            isContact: path === '/contact.html',
            urlParams
        };
    }

    /**
     * Get page-specific meta information
     */
    getPageMeta(page) {
        const baseMeta = { ...this.defaultMeta };
        
        if (page.isHome) {
            return {
                ...baseMeta,
                title: 'Brum Outloud - LGBTQ+ Birmingham Guide',
                description: 'Your essential guide to Birmingham\'s vibrant LGBTQ+ scene. Discover queer-friendly events, venues, and community resources for residents and visitors.',
                keywords: 'LGBTQ+, Birmingham, queer events, gay bars, lesbian venues, transgender friendly, Birmingham Pride, queer community, LGBTQ+ guide',
                type: 'website'
            };
        }
        
        if (page.isEvents) {
            return {
                ...baseMeta,
                title: 'LGBTQ+ Events in Birmingham | Brum Outloud',
                description: 'Discover upcoming LGBTQ+ events in Birmingham. From drag shows and club nights to community meetups and Pride celebrations.',
                keywords: 'LGBTQ+ events, Birmingham events, queer events, drag shows, club nights, Birmingham Pride, LGBTQ+ community events',
                type: 'website',
                url: 'https://brumoutloud.co.uk/events.html'
            };
        }
        
        if (page.isVenues) {
            return {
                ...baseMeta,
                title: 'LGBTQ+ Friendly Venues in Birmingham | Brum Outloud',
                description: 'Find LGBTQ+ friendly venues in Birmingham. Bars, clubs, restaurants, and community spaces that welcome the queer community.',
                keywords: 'LGBTQ+ venues, gay bars Birmingham, lesbian venues, transgender friendly spaces, queer community spaces, Birmingham LGBTQ+',
                type: 'website',
                url: 'https://brumoutloud.co.uk/all-venues.html'
            };
        }
        
        if (page.isSubmit) {
            return {
                ...baseMeta,
                title: 'Submit Your Event or Venue | Brum Outloud',
                description: 'Submit your LGBTQ+ event or venue to Brum Outloud. Help us build Birmingham\'s most comprehensive queer community guide.',
                keywords: 'submit event, submit venue, LGBTQ+ event submission, Birmingham queer events, community submissions',
                type: 'website',
                url: 'https://brumoutloud.co.uk/promoter-tool.html'
            };
        }
        
        if (page.isCommunity) {
            return {
                ...baseMeta,
                title: 'LGBTQ+ Community Resources | Brum Outloud',
                description: 'Connect with Birmingham\'s LGBTQ+ community. Find support groups, resources, and ways to get involved.',
                keywords: 'LGBTQ+ community, Birmingham queer community, support groups, LGBTQ+ resources, community involvement',
                type: 'website',
                url: 'https://brumoutloud.co.uk/community.html'
            };
        }
        
        if (page.isContact) {
            return {
                ...baseMeta,
                title: 'Contact Us | Brum Outloud',
                description: 'Get in touch with Brum Outloud. We\'re here to help with event listings, venue information, and community support.',
                keywords: 'contact Brum Outloud, LGBTQ+ Birmingham contact, event support, venue information',
                type: 'website',
                url: 'https://brumoutloud.co.uk/contact.html'
            };
        }
        
        return baseMeta;
    }

    /**
     * Update meta tags
     */
    updateMetaTags(meta) {
        this.setMetaTag('title', meta.title);
        this.setMetaTag('description', meta.description);
        this.setMetaTag('keywords', meta.keywords);
        this.setMetaTag('author', 'Brum Outloud');
        this.setMetaTag('robots', 'index, follow');
        this.setMetaTag('language', 'en-GB');
        this.setMetaTag('geo.region', 'GB-BIR');
        this.setMetaTag('geo.placename', 'Birmingham');
        this.setMetaTag('geo.position', '52.4862;-1.8904');
        this.setMetaTag('ICBM', '52.4862, -1.8904');
    }

    /**
     * Update Open Graph tags
     */
    updateOpenGraph(meta) {
        this.setMetaTag('og:title', meta.title);
        this.setMetaTag('og:description', meta.description);
        this.setMetaTag('og:image', meta.image);
        this.setMetaTag('og:url', meta.url);
        this.setMetaTag('og:type', meta.type);
        this.setMetaTag('og:site_name', meta.siteName);
        this.setMetaTag('og:locale', 'en_GB');
        this.setMetaTag('og:image:width', '1200');
        this.setMetaTag('og:image:height', '630');
        this.setMetaTag('og:image:alt', meta.title);
    }

    /**
     * Update Twitter Card tags
     */
    updateTwitterCard(meta) {
        this.setMetaTag('twitter:card', 'summary_large_image');
        this.setMetaTag('twitter:site', meta.twitterHandle);
        this.setMetaTag('twitter:creator', meta.twitterHandle);
        this.setMetaTag('twitter:title', meta.title);
        this.setMetaTag('twitter:description', meta.description);
        this.setMetaTag('twitter:image', meta.image);
        this.setMetaTag('twitter:image:alt', meta.title);
    }

    /**
     * Set meta tag
     */
    setMetaTag(name, content) {
        if (!content) return;
        
        let element = document.querySelector(`meta[name="${name}"]`) || 
                     document.querySelector(`meta[property="${name}"]`);
        
        if (!element) {
            element = document.createElement('meta');
            if (name.startsWith('og:') || name.startsWith('twitter:')) {
                element.setAttribute('property', name);
            } else {
                element.setAttribute('name', name);
            }
            document.head.appendChild(element);
        }
        
        element.setAttribute('content', content);
    }

    /**
     * Setup structured data
     */
    setupStructuredData() {
        const page = this.getCurrentPage();
        const structuredData = this.getStructuredData(page);
        
        if (structuredData) {
            this.addStructuredData(structuredData);
        }
    }

    /**
     * Get structured data for current page
     */
    getStructuredData(page) {
        const baseData = {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Brum Outloud',
            url: 'https://brumoutloud.co.uk',
            description: 'Your essential guide to Birmingham\'s vibrant LGBTQ+ scene',
            publisher: {
                '@type': 'Organization',
                name: 'Brum Outloud',
                url: 'https://brumoutloud.co.uk'
            }
        };

        if (page.isHome) {
            return {
                ...baseData,
                '@type': 'WebSite',
                potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://brumoutloud.co.uk/events.html?search={search_term_string}',
                    'query-input': 'required name=search_term_string'
                }
            };
        }

        if (page.isEvents) {
            return {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: 'LGBTQ+ Events in Birmingham',
                description: 'Upcoming LGBTQ+ events in Birmingham',
                url: 'https://brumoutloud.co.uk/events.html',
                itemListElement: this.getEventStructuredData()
            };
        }

        if (page.isVenues) {
            return {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: 'LGBTQ+ Friendly Venues in Birmingham',
                description: 'LGBTQ+ friendly venues in Birmingham',
                url: 'https://brumoutloud.co.uk/all-venues.html',
                itemListElement: this.getVenueStructuredData()
            };
        }

        return baseData;
    }

    /**
     * Get event structured data
     */
    getEventStructuredData() {
        // This would be populated with actual event data
        return [];
    }

    /**
     * Get venue structured data
     */
    getVenueStructuredData() {
        // This would be populated with actual venue data
        return [];
    }

    /**
     * Add structured data to page
     */
    addStructuredData(data) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
    }

    /**
     * Setup social sharing
     */
    setupSocialSharing() {
        this.addSocialSharingButtons();
        this.setupShareAPI();
    }

    /**
     * Add social sharing buttons
     */
    addSocialSharingButtons() {
        // Add sharing buttons to event and venue pages
        const page = this.getCurrentPage();
        
        if (page.isEvents || page.isVenues) {
            this.addSharingButtons();
        }
    }

    /**
     * Add sharing buttons to page
     */
    addSharingButtons() {
        const shareContainer = document.createElement('div');
        shareContainer.className = 'social-sharing';
        shareContainer.innerHTML = `
            <div class="share-buttons">
                <button class="btn-share btn-facebook" onclick="window.seoManager.shareToFacebook()">
                    <i class="fab fa-facebook-f"></i>
                    <span>Share</span>
                </button>
                <button class="btn-share btn-twitter" onclick="window.seoManager.shareToTwitter()">
                    <i class="fab fa-twitter"></i>
                    <span>Tweet</span>
                </button>
                <button class="btn-share btn-whatsapp" onclick="window.seoManager.shareToWhatsApp()">
                    <i class="fab fa-whatsapp"></i>
                    <span>Share</span>
                </button>
                <button class="btn-share btn-copy" onclick="window.seoManager.copyToClipboard()">
                    <i class="fas fa-link"></i>
                    <span>Copy Link</span>
                </button>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('social-sharing-styles')) {
            const style = document.createElement('style');
            style.id = 'social-sharing-styles';
            style.textContent = `
                .social-sharing {
                    margin: 2rem 0;
                    padding: 1rem;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 0.5rem;
                    border: 1px solid rgba(232, 58, 153, 0.2);
                }
                
                .share-buttons {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                
                .btn-share {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                }
                
                .btn-facebook {
                    background: #1877f2;
                    color: white;
                }
                
                .btn-twitter {
                    background: #1da1f2;
                    color: white;
                }
                
                .btn-whatsapp {
                    background: #25d366;
                    color: white;
                }
                
                .btn-copy {
                    background: #6b7280;
                    color: white;
                }
                
                .btn-share:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }
                
                @media (max-width: 768px) {
                    .share-buttons {
                        justify-content: center;
                    }
                    
                    .btn-share {
                        flex: 1;
                        justify-content: center;
                        min-width: 120px;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Insert after main content
        const main = document.querySelector('main') || document.querySelector('.container');
        if (main) {
            main.appendChild(shareContainer);
        }
    }

    /**
     * Setup Web Share API
     */
    setupShareAPI() {
        if (navigator.share) {
            // Add native share button for supported devices
            this.addNativeShareButton();
        }
    }

    /**
     * Add native share button
     */
    addNativeShareButton() {
        const shareButton = document.createElement('button');
        shareButton.className = 'btn-share btn-native';
        shareButton.innerHTML = `
            <i class="fas fa-share-alt"></i>
            <span>Share</span>
        `;
        shareButton.onclick = () => this.nativeShare();
        
        // Add to existing share buttons
        const shareButtons = document.querySelector('.share-buttons');
        if (shareButtons) {
            shareButtons.appendChild(shareButton);
        }
    }

    /**
     * Share to Facebook
     */
    shareToFacebook() {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(document.title);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
        this.trackShare('facebook');
    }

    /**
     * Share to Twitter
     */
    shareToTwitter() {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(document.title);
        window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
        this.trackShare('twitter');
    }

    /**
     * Share to WhatsApp
     */
    shareToWhatsApp() {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(document.title);
        window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
        this.trackShare('whatsapp');
    }

    /**
     * Copy to clipboard
     */
    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            this.showCopySuccess();
            this.trackShare('clipboard');
        } catch (error) {
            ErrorHandler.error('Failed to copy to clipboard:', error);
        }
    }

    /**
     * Native share
     */
    async nativeShare() {
        try {
            await navigator.share({
                title: document.title,
                text: document.querySelector('meta[name="description"]')?.content || '',
                url: window.location.href
            });
            this.trackShare('native');
        } catch (error) {
            ErrorHandler.error('Native share failed:', error);
        }
    }

    /**
     * Show copy success message
     */
    showCopySuccess() {
        const notification = document.createElement('div');
        notification.className = 'copy-success';
        notification.innerHTML = `
            <div class="copy-content">
                <i class="fas fa-check text-green-500"></i>
                <span>Link copied to clipboard!</span>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('copy-success-styles')) {
            const style = document.createElement('style');
            style.id = 'copy-success-styles';
            style.textContent = `
                .copy-success {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #059669;
                    color: white;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                }
                
                .copy-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * Setup analytics
     */
    setupAnalytics() {
        // Track page views
        this.trackPageView();
        
        // Track user interactions
        this.trackUserInteractions();
    }

    /**
     * Track page view
     */
    trackPageView() {
        const page = this.getCurrentPage();
        this.trackEvent('page_view', {
            page: page.path,
            title: document.title,
            url: window.location.href
        });
    }

    /**
     * Track user interactions
     */
    trackUserInteractions() {
        // Track form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.tagName === 'FORM') {
                this.trackEvent('form_submit', {
                    form: e.target.id || e.target.className,
                    page: window.location.pathname
                });
            }
        });

        // Track button clicks
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
                this.trackEvent('button_click', {
                    button: button.textContent?.trim() || button.className,
                    page: window.location.pathname
                });
            }
        });
    }

    /**
     * Track share events
     */
    trackShare(platform) {
        this.trackEvent('share', {
            platform,
            page: window.location.pathname,
            url: window.location.href
        });
    }

    /**
     * Track events
     */
    trackEvent(eventName, data = {}) {
        // In production, this would send to analytics service
        ErrorHandler.log('SEO Event:', eventName, data);
        
        // Store in localStorage for debugging
        try {
            const events = JSON.parse(localStorage.getItem('seo_events') || '[]');
            events.push({
                event: eventName,
                data,
                timestamp: new Date().toISOString()
            });
            
            if (events.length > 100) events.shift(); // Keep only last 100 events
            localStorage.setItem('seo_events', JSON.stringify(events));
        } catch (error) {
            ErrorHandler.warn('Failed to store SEO event:', error);
        }
    }
}

// Initialize SEO manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.seoManager = new SEOManager();
});

// Export for use in other modules
window.SEOManager = SEOManager;
