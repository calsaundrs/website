class AdminNotificationPoller {
  constructor() {
    this.pollingInterval = null;
    this.lastNotificationId = null;
    this.isPolling = false;
    this.pollInterval = 30000; // 30 seconds
  }

  start() {
    if (this.isPolling) {
      console.log('Notification poller already running');
      return;
    }

    console.log('Starting notification poller...');
    this.isPolling = true;
    
    // Poll immediately
    this.checkForNotifications();
    
    // Then poll every 30 seconds
    this.pollingInterval = setInterval(() => {
      this.checkForNotifications();
    }, this.pollInterval);
  }

  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('Notification poller stopped');
  }

  async checkForNotifications() {
    try {
      // Check for new event submissions
      await this.checkForNewSubmissions();
      
      // Check for general system notifications
      const response = await fetch('/.netlify/functions/get-notifications');
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        // Get the most recent notification
        const latestNotification = data.data[0];
        
        // Check if this is a new notification
        if (!this.lastNotificationId || latestNotification.id !== this.lastNotificationId) {
          this.lastNotificationId = latestNotification.id;
          
          // Check if it's a recent notification (within last 5 minutes)
          const notificationTime = new Date(latestNotification.timestamp);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          
          if (notificationTime > fiveMinutesAgo) {
            await this.sendBrowserNotification(latestNotification);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for notifications:', error);
    }
  }

  async checkForNewSubmissions() {
    try {
      // Get pending events to check for new submissions
      const response = await fetch('/.netlify/functions/get-pending-events');
      const data = await response.json();
      
      if (data.success && data.events && data.events.length > 0) {
        // Get the most recent pending event
        const latestEvent = data.events[0];
        
        // Check if this is a new submission (within last 10 minutes)
        const submissionTime = new Date(latestEvent.submittedAt || latestEvent.createdAt);
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        if (submissionTime > tenMinutesAgo) {
          // Check if we've already notified about this event
          const eventKey = `submission_${latestEvent.id}`;
          const lastNotified = localStorage.getItem(eventKey);
          
          if (!lastNotified || new Date(lastNotified) < submissionTime) {
            // Send push notification for new submission
            await this.sendNewSubmissionNotification(latestEvent);
            
            // Mark as notified
            localStorage.setItem(eventKey, new Date().toISOString());
          }
        }
      }
    } catch (error) {
      console.error('Error checking for new submissions:', error);
    }
  }

  async sendNewSubmissionNotification(event) {
    if (!window.pushNotificationService || !window.pushNotificationService.isEnabled()) {
      console.log('Push notifications not available for new submission alert');
      return;
    }

    try {
      const eventName = event.name || 'Untitled Event';
      const promoterEmail = event.submittedBy || event.submitterEmail || 'Unknown';
      const eventId = event.id;
      
      await window.pushNotificationService.sendNewSubmissionAlert(
        eventName, 
        promoterEmail, 
        eventId
      );
      
      console.log('New submission notification sent:', eventName);
    } catch (error) {
      console.error('Error sending new submission notification:', error);
    }
  }

  async sendBrowserNotification(notification) {
    // Check if push notifications are available and enabled
    if (!window.pushNotificationService || !window.pushNotificationService.isEnabled()) {
      console.log('Push notifications not available or not enabled');
      return;
    }

    try {
      const severity = notification.severity || 'medium';
      const title = notification.title || 'System Alert';
      const message = notification.message || 'A system notification has been received';
      
      await window.pushNotificationService.sendSystemAlert(title, message, severity);
      
      console.log('Browser notification sent:', title);
    } catch (error) {
      console.error('Error sending browser notification:', error);
    }
  }

  setPollInterval(interval) {
    this.pollInterval = interval;
    
    // Restart polling with new interval
    if (this.isPolling) {
      this.stop();
      this.start();
    }
  }

  getStatus() {
    return {
      isPolling: this.isPolling,
      pollInterval: this.pollInterval,
      lastNotificationId: this.lastNotificationId
    };
  }
}

// Create global instance when script loads
if (typeof window !== 'undefined') {
  window.AdminNotificationPoller = AdminNotificationPoller;
  
  // Auto-start when DOM is loaded (only on admin pages)
  document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('admin')) {
      if (!window.adminNotificationPoller) {
        window.adminNotificationPoller = new AdminNotificationPoller();
      }
      // Start polling after a short delay to ensure push notifications are initialized
      setTimeout(() => {
        window.adminNotificationPoller.start();
      }, 2000);
    }
  });

  // Stop polling when page is unloaded
  window.addEventListener('beforeunload', function() {
    if (window.adminNotificationPoller) {
      window.adminNotificationPoller.stop();
    }
  });
}