class PushNotificationService {
  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
    this.subscription = null;
  }

  async initialize() {
    if (!this.isSupported) {
      console.log('Push notifications not supported in this browser');
      return false;
    }

    // Check if we already have permission
    if (this.permission === 'granted') {
      console.log('Push notifications already enabled');
      return true;
    }

    // Request permission if not already granted
    if (this.permission === 'default') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('Push notifications enabled');
        return true;
      } else {
        console.log('Push notifications denied');
        return false;
      }
    }

    return false;
  }

  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    
    if (permission === 'granted') {
      console.log('Push notifications enabled');
      return true;
    } else {
      console.log('Push notifications denied');
      return false;
    }
  }

  async sendNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      console.log('Cannot send notification - not supported or permission denied');
      return false;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'system-alert',
        requireInteraction: true,
        ...options
      });

      // Auto-close after 10 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      // Handle click events
      notification.onclick = function(event) {
        event.preventDefault();
        notification.close();
        
        // Focus the admin window/tab
        window.focus();
        
        // Navigate to system status page if it's a system alert
        if (options.tag === 'system-alert') {
          window.location.href = '/admin-system-status.html';
        }
      };

      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  async sendSystemAlert(title, message, severity = 'medium') {
    const icons = {
      high: '🚨',
      medium: '⚠️',
      low: 'ℹ️'
    };

    const icon = icons[severity] || icons.medium;
    
    return this.sendNotification(`${icon} ${title}`, {
      body: message,
      tag: 'system-alert',
      requireInteraction: severity === 'high',
      data: {
        type: 'system-alert',
        severity: severity,
        timestamp: new Date().toISOString()
      }
    });
  }

  async sendTestNotification() {
    return this.sendNotification('🧪 Test Notification', {
      body: 'This is a test notification from the system monitoring service.',
      tag: 'test-notification',
      requireInteraction: false
    });
  }

  isEnabled() {
    return this.isSupported && this.permission === 'granted';
  }

  getPermissionStatus() {
    return this.permission;
  }
}

// Create global instance when script loads
if (typeof window !== 'undefined') {
  window.PushNotificationService = PushNotificationService;
  
  // Auto-initialize when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on an admin page
    if (window.location.pathname.includes('admin')) {
      if (!window.pushNotificationService) {
        window.pushNotificationService = new PushNotificationService();
      }
      window.pushNotificationService.initialize();
    }
  });
}