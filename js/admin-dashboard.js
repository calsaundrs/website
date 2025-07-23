document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin Dashboard loaded successfully!');
    
    // Dashboard elements
    const pendingEventsCount = document.getElementById('pending-events-count');
    const pendingVenuesCount = document.getElementById('pending-venues-count');
    const totalEventsCount = document.getElementById('total-events-count');
    const totalVenuesCount = document.getElementById('total-venues-count');
    const pendingEventsBadge = document.getElementById('pending-events-badge');
    const pendingVenuesBadge = document.getElementById('pending-venues-badge');
    const approvalBadge = document.getElementById('approval-badge');
    const recentActivity = document.getElementById('recent-activity');
    const settingsForm = document.getElementById('settings-form');
    
    // State variables
    let dashboardData = {
        pendingEvents: 0,
        pendingVenues: 0,
        totalEvents: 0,
        totalVenues: 0,
        recentActivity: []
    };
    
    let refreshInterval;
    let lastNotificationTime = localStorage.getItem('lastNotificationTime') || 0;
    
    // Initialize dashboard
    async function initializeDashboard() {
        await loadDashboardStats();
        await loadRecentActivity();
        await loadSettings();
        setupAutoRefresh();
        setupNotifications();
    }
    
    // Load dashboard statistics
    async function loadDashboardStats() {
        try {
            // Load pending events
            const pendingEventsResponse = await fetch('/.netlify/functions/get-pending-items');
            const pendingEvents = await pendingEventsResponse.json();
            
            // Load pending venues
            const pendingVenuesResponse = await fetch('/.netlify/functions/get-pending-venues');
            const pendingVenues = await pendingVenuesResponse.json();
            
            // Load total counts (we'll need to create these functions)
            const totalEventsResponse = await fetch('/.netlify/functions/get-events-count');
            const totalEvents = await totalEventsResponse.json();
            
            const totalVenuesResponse = await fetch('/.netlify/functions/get-venues-count');
            const totalVenues = await totalVenuesResponse.json();
            
            // Update dashboard data
            dashboardData.pendingEvents = pendingEvents.length || 0;
            dashboardData.pendingVenues = pendingVenues.length || 0;
            dashboardData.totalEvents = totalEvents.count || 0;
            dashboardData.totalVenues = totalVenues.count || 0;
            
            // Update UI
            updateDashboardStats();
            updateNotificationBadges();
            
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            // Set fallback values
            pendingEventsCount.textContent = '?';
            pendingVenuesCount.textContent = '?';
            totalEventsCount.textContent = '?';
            totalVenuesCount.textContent = '?';
        }
    }
    
    // Update dashboard statistics display
    function updateDashboardStats() {
        pendingEventsCount.textContent = dashboardData.pendingEvents;
        pendingVenuesCount.textContent = dashboardData.pendingVenues;
        totalEventsCount.textContent = dashboardData.totalEvents;
        totalVenuesCount.textContent = dashboardData.totalVenues;
        
        // Add urgent styling for high pending counts
        const pendingEventsCard = pendingEventsCount.closest('.stats-card');
        const pendingVenuesCard = pendingVenuesCount.closest('.stats-card');
        
        if (dashboardData.pendingEvents > 5) {
            pendingEventsCard.classList.add('urgent');
        } else {
            pendingEventsCard.classList.remove('urgent');
        }
        
        if (dashboardData.pendingVenues > 3) {
            pendingVenuesCard.classList.add('urgent');
        } else {
            pendingVenuesCard.classList.remove('urgent');
        }
    }
    
    // Update notification badges
    function updateNotificationBadges() {
        // Pending events badge
        if (dashboardData.pendingEvents > 0) {
            pendingEventsBadge.textContent = dashboardData.pendingEvents;
            pendingEventsBadge.classList.remove('hidden');
        } else {
            pendingEventsBadge.classList.add('hidden');
        }
        
        // Pending venues badge
        if (dashboardData.pendingVenues > 0) {
            pendingVenuesBadge.textContent = dashboardData.pendingVenues;
            pendingVenuesBadge.classList.remove('hidden');
        } else {
            pendingVenuesBadge.classList.add('hidden');
        }
        
        // Approval badge (total pending)
        const totalPending = dashboardData.pendingEvents + dashboardData.pendingVenues;
        if (totalPending > 0) {
            approvalBadge.textContent = totalPending;
            approvalBadge.classList.remove('hidden');
        } else {
            approvalBadge.classList.add('hidden');
        }
    }
    
    // Load recent activity
    async function loadRecentActivity() {
        try {
            const response = await fetch('/.netlify/functions/get-recent-activity');
            const activity = await response.json();
            
            dashboardData.recentActivity = activity;
            displayRecentActivity(activity);
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
            displayRecentActivity([]);
        }
    }
    
    // Display recent activity
    function displayRecentActivity(activity) {
        if (!activity || activity.length === 0) {
            recentActivity.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl text-gray-600 mb-4">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <p class="text-gray-400">No recent activity</p>
                </div>
            `;
            return;
        }
        
        const activityHtml = activity.map(item => {
            const timeAgo = getTimeAgo(new Date(item.timestamp));
            const icon = getActivityIcon(item.type);
            const color = getActivityColor(item.type);
            
            return `
                <div class="flex items-center space-x-4 p-4 bg-gray-800/50 rounded-lg">
                    <div class="text-2xl ${color}">
                        <i class="${icon}"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-white font-medium">${item.title}</p>
                        <p class="text-gray-400 text-sm">${item.description}</p>
                    </div>
                    <div class="text-gray-500 text-sm">
                        ${timeAgo}
                    </div>
                </div>
            `;
        }).join('');
        
        recentActivity.innerHTML = activityHtml;
    }
    
    // Get activity icon based on type
    function getActivityIcon(type) {
        const icons = {
            'event_approved': 'fas fa-check-circle',
            'event_rejected': 'fas fa-times-circle',
            'venue_approved': 'fas fa-map-marker-check',
            'venue_rejected': 'fas fa-map-marker-times',
            'event_submitted': 'fas fa-calendar-plus',
            'venue_submitted': 'fas fa-map-marker-plus',
            'system': 'fas fa-cog'
        };
        return icons[type] || 'fas fa-info-circle';
    }
    
    // Get activity color based on type
    function getActivityColor(type) {
        const colors = {
            'event_approved': 'text-green-400',
            'venue_approved': 'text-green-400',
            'event_rejected': 'text-red-400',
            'venue_rejected': 'text-red-400',
            'event_submitted': 'text-blue-400',
            'venue_submitted': 'text-blue-400',
            'system': 'text-gray-400'
        };
        return colors[type] || 'text-gray-400';
    }
    
    // Get time ago string
    function getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
    
    // Load settings
    async function loadSettings() {
        try {
            const response = await fetch('/.netlify/functions/get-settings');
            const settings = await response.json();
            
            // Populate form fields
            Object.keys(settings).forEach(key => {
                const field = document.getElementById(key);
                if (field) {
                    field.value = settings[key] || '';
                }
            });
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    // Save settings
    async function saveSettings(formData) {
        try {
            const response = await fetch('/.netlify/functions/update-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });
            
            if (response.ok) {
                showNotification('Settings saved successfully!', 'success');
            } else {
                throw new Error('Failed to save settings');
            }
            
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Error saving settings', 'error');
        }
    }
    
    // Setup auto-refresh
    function setupAutoRefresh() {
        // Refresh dashboard every 30 seconds
        refreshInterval = setInterval(async () => {
            await loadDashboardStats();
            await loadRecentActivity();
        }, 30000);
    }
    
    // Setup notifications
    function setupNotifications() {
        // Check for new submissions every 60 seconds
        setInterval(async () => {
            await checkForNewSubmissions();
        }, 60000);
    }
    
    // Check for new submissions
    async function checkForNewSubmissions() {
        try {
            const response = await fetch('/.netlify/functions/get-pending-items');
            const pendingItems = await response.json();
            
            const currentTime = Date.now();
            const timeSinceLastCheck = currentTime - lastNotificationTime;
            
            // Only show notification if we haven't checked recently and there are new items
            if (timeSinceLastCheck > 300000 && pendingItems.length > 0) { // 5 minutes
                const newItems = pendingItems.filter(item => {
                    const itemTime = new Date(item.fields.Date || item.createdTime).getTime();
                    return itemTime > lastNotificationTime;
                });
                
                if (newItems.length > 0) {
                    showBrowserNotification(`New ${newItems.length} submission(s) awaiting review`);
                    lastNotificationTime = currentTime;
                    localStorage.setItem('lastNotificationTime', currentTime.toString());
                }
            }
            
        } catch (error) {
            console.error('Error checking for new submissions:', error);
        }
    }
    
    // Show browser notification
    function showBrowserNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Brum Outloud Admin', {
                body: message,
                icon: '/faviconV2.png'
            });
        }
    }
    
    // Show in-app notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg text-white z-50 transition-all duration-300 transform translate-x-full`;
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };
        
        notification.classList.add(colors[type] || colors.info);
        notification.innerHTML = `
            <div class="flex items-center space-x-2">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // Request notification permission
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    // Event listeners
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(settingsForm);
        await saveSettings(formData);
    });
    
    // Request notification permission on page load
    requestNotificationPermission();
    
    // Initialize dashboard
    initializeDashboard();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    });
});