/**
 * Progressive Web App (PWA) Manager
 * Phase 5: Advanced Features & Polish
 */

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isOnline = navigator.onLine;
        this.init();
    }

    init() {
        this.setupInstallPrompt();
        this.setupOnlineOfflineHandling();
        this.setupServiceWorker();
        this.setupPushNotifications();
        this.setupAppUpdateDetection();
        this.setupBackgroundSync();
    }

    /**
     * Setup install prompt handling
     */
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            
            // Show install button if not already installed
            if (!this.isInstalled) {
                this.showInstallPrompt();
            }
        });

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.hideInstallPrompt();
            this.showInstallSuccess();
            
            // Track installation
            this.trackEvent('pwa_installed');
        });
    }

    /**
     * Show install prompt
     */
    showInstallPrompt() {
        // Check if we should show the prompt
        if (this.shouldShowInstallPrompt()) {
            const installBanner = this.createInstallBanner();
            document.body.appendChild(installBanner);
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (installBanner.parentElement) {
                    installBanner.remove();
                }
            }, 10000);
        }
    }

    /**
     * Check if we should show install prompt
     */
    shouldShowInstallPrompt() {
        // Don't show if already installed
        if (this.isInstalled) return false;
        
        // Don't show if user dismissed recently
        const lastDismissed = localStorage.getItem('pwa_install_dismissed');
        if (lastDismissed) {
            const dismissedTime = new Date(lastDismissed);
            const now = new Date();
            const hoursSinceDismissed = (now - dismissedTime) / (1000 * 60 * 60);
            if (hoursSinceDismissed < 24) return false;
        }
        
        // Don't show on mobile (they have their own install prompts)
        if (window.innerWidth < 768) return false;
        
        return true;
    }

    /**
     * Create install banner
     */
    createInstallBanner() {
        const banner = document.createElement('div');
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-install-content">
                <div class="pwa-install-info">
                    <i class="fas fa-download text-accent-color"></i>
                    <div>
                        <h3>Install Brum Outloud</h3>
                        <p>Get quick access to Birmingham's LGBTQ+ events and venues</p>
                    </div>
                </div>
                <div class="pwa-install-actions">
                    <button class="btn-primary btn-install" onclick="window.pwaManager.installApp()">
                        <i class="fas fa-plus mr-2"></i>Install
                    </button>
                    <button class="btn-secondary btn-dismiss" onclick="window.pwaManager.dismissInstallPrompt()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('pwa-install-styles')) {
            const style = document.createElement('style');
            style.id = 'pwa-install-styles';
            style.textContent = `
                .pwa-install-banner {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                    border: 1px solid rgba(232, 58, 153, 0.3);
                    border-radius: 12px;
                    padding: 1rem;
                    z-index: 10000;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    animation: slideUp 0.3s ease;
                }
                
                .pwa-install-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                }
                
                .pwa-install-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex: 1;
                }
                
                .pwa-install-info h3 {
                    font-size: 1rem;
                    font-weight: bold;
                    margin: 0;
                    color: white;
                }
                
                .pwa-install-info p {
                    font-size: 0.875rem;
                    margin: 0;
                    color: #d1d5db;
                }
                
                .pwa-install-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .btn-install {
                    padding: 0.5rem 1rem;
                    font-size: 0.875rem;
                }
                
                .btn-dismiss {
                    padding: 0.5rem;
                    min-width: auto;
                }
                
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                
                @media (max-width: 768px) {
                    .pwa-install-banner {
                        left: 10px;
                        right: 10px;
                        bottom: 10px;
                    }
                    
                    .pwa-install-content {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    
                    .pwa-install-actions {
                        justify-content: center;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        return banner;
    }

    /**
     * Install the app
     */
    async installApp() {
        if (!this.deferredPrompt) {
            ErrorHandler.warn('Install prompt not available');
            return;
        }

        try {
            // Show the install prompt
            this.deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                ErrorHandler.log('User accepted the install prompt');
                this.trackEvent('pwa_install_accepted');
            } else {
                ErrorHandler.log('User dismissed the install prompt');
                this.trackEvent('pwa_install_dismissed');
            }
            
            // Clear the deferredPrompt
            this.deferredPrompt = null;
            
            // Hide the banner
            this.hideInstallPrompt();
            
        } catch (error) {
            ErrorHandler.error('Error during app installation:', error);
        }
    }

    /**
     * Dismiss install prompt
     */
    dismissInstallPrompt() {
        this.hideInstallPrompt();
        
        // Remember dismissal
        localStorage.setItem('pwa_install_dismissed', new Date().toISOString());
        
        this.trackEvent('pwa_install_dismissed');
    }

    /**
     * Hide install prompt
     */
    hideInstallPrompt() {
        const banner = document.querySelector('.pwa-install-banner');
        if (banner) {
            banner.remove();
        }
    }

    /**
     * Show install success message
     */
    showInstallSuccess() {
        const notification = document.createElement('div');
        notification.className = 'pwa-success-notification';
        notification.innerHTML = `
            <div class="pwa-success-content">
                <i class="fas fa-check-circle text-green-500"></i>
                <span>Brum Outloud installed successfully!</span>
                <button class="pwa-success-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('pwa-success-styles')) {
            const style = document.createElement('style');
            style.id = 'pwa-success-styles';
            style.textContent = `
                .pwa-success-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #059669;
                    color: white;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    max-width: 300px;
                    animation: slideIn 0.3s ease;
                }
                
                .pwa-success-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .pwa-success-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: auto;
                }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Setup online/offline handling
     */
    setupOnlineOfflineHandling() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showOnlineNotification();
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showOfflineNotification();
        });
    }

    /**
     * Show online notification
     */
    showOnlineNotification() {
        const notification = document.createElement('div');
        notification.className = 'online-notification';
        notification.innerHTML = `
            <div class="online-content">
                <i class="fas fa-wifi text-green-500"></i>
                <span>You're back online!</span>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('online-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'online-notification-styles';
            style.textContent = `
                .online-notification {
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
                
                .online-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
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
     * Show offline notification
     */
    showOfflineNotification() {
        const notification = document.createElement('div');
        notification.className = 'offline-notification';
        notification.innerHTML = `
            <div class="offline-content">
                <i class="fas fa-wifi-slash text-yellow-500"></i>
                <span>You're offline. Some features may be limited.</span>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('offline-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'offline-notification-styles';
            style.textContent = `
                .offline-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #d97706;
                    color: white;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                }
                
                .offline-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Setup service worker
     */
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    ErrorHandler.log('Service Worker registered:', registration);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showUpdateNotification();
                            }
                        });
                    });
                    
                } catch (error) {
                    ErrorHandler.error('Service Worker registration failed:', error);
                }
            });
        }
    }

    /**
     * Show update notification
     */
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <i class="fas fa-sync-alt text-blue-500"></i>
                <span>New version available</span>
                <button class="btn-primary btn-update" onclick="window.pwaManager.updateApp()">
                    Update
                </button>
                <button class="btn-secondary btn-dismiss" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('update-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'update-notification-styles';
            style.textContent = `
                .update-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #2563eb;
                    color: white;
                    padding: 1rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    max-width: 300px;
                    animation: slideIn 0.3s ease;
                }
                
                .update-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .btn-update {
                    padding: 0.25rem 0.5rem;
                    font-size: 0.75rem;
                }
                
                .btn-dismiss {
                    padding: 0.25rem;
                    min-width: auto;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);
    }

    /**
     * Update the app
     */
    updateApp() {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }

    /**
     * Setup push notifications
     */
    setupPushNotifications() {
        if ('Notification' in window && 'serviceWorker' in navigator) {
            // Request permission on user interaction
            document.addEventListener('click', () => {
                if (Notification.permission === 'default') {
                    this.requestNotificationPermission();
                }
            }, { once: true });
        }
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.trackEvent('notifications_granted');
                this.showNotificationSuccess();
            }
        } catch (error) {
            ErrorHandler.error('Error requesting notification permission:', error);
        }
    }

    /**
     * Show notification success
     */
    showNotificationSuccess() {
        const notification = document.createElement('div');
        notification.className = 'notification-success';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-bell text-green-500"></i>
                <span>Notifications enabled! Stay updated with new events.</span>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('notification-success-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-success-styles';
            style.textContent = `
                .notification-success {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #059669;
                    color: white;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                    z-index: 10000;
                    max-width: 300px;
                    animation: slideIn 0.3s ease;
                }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Setup background sync
     */
    setupBackgroundSync() {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            // Background sync will be handled by the service worker
            ErrorHandler.log('Background sync available');
        }
    }

    /**
     * Setup app update detection
     */
    setupAppUpdateDetection() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                ErrorHandler.log('Service Worker controller changed - app updated');
                this.trackEvent('pwa_updated');
            });
        }
    }

    /**
     * Sync offline data
     */
    async syncOfflineData() {
        // Sync any offline form submissions
        const offlineSubmissions = JSON.parse(localStorage.getItem('offline_submissions') || '[]');
        
        if (offlineSubmissions.length > 0) {
            ErrorHandler.log('Syncing offline submissions:', offlineSubmissions.length);
            
            for (const submission of offlineSubmissions) {
                try {
                    await this.submitOfflineData(submission);
                } catch (error) {
                    ErrorHandler.error('Failed to sync offline submission:', error);
                }
            }
            
            // Clear synced submissions
            localStorage.removeItem('offline_submissions');
        }
    }

    /**
     * Submit offline data
     */
    async submitOfflineData(submission) {
        const response = await fetch(submission.url, {
            method: submission.method,
            headers: submission.headers,
            body: submission.body
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }

    /**
     * Track events
     */
    trackEvent(eventName, data = {}) {
        // In production, this would send to analytics service
        ErrorHandler.log('PWA Event:', eventName, data);
        
        // Store in localStorage for debugging
        try {
            const events = JSON.parse(localStorage.getItem('pwa_events') || '[]');
            events.push({
                event: eventName,
                data,
                timestamp: new Date().toISOString()
            });
            
            if (events.length > 100) events.shift(); // Keep only last 100 events
            localStorage.setItem('pwa_events', JSON.stringify(events));
        } catch (error) {
            ErrorHandler.warn('Failed to store PWA event:', error);
        }
    }

    /**
     * Get PWA status
     */
    getStatus() {
        return {
            isInstalled: this.isInstalled,
            isOnline: this.isOnline,
            canInstall: !!this.deferredPrompt,
            notificationPermission: Notification.permission,
            serviceWorkerSupported: 'serviceWorker' in navigator,
            pushSupported: 'PushManager' in window
        };
    }
}

// Initialize PWA manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});

// Export for use in other modules
window.PWAManager = PWAManager;
