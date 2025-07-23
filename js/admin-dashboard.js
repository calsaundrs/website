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
        console.log('Initializing admin dashboard...');
        
        try {
            await loadDashboardStats();
            await loadRecentActivity();
            await loadSettings();
            setupAutoRefresh();
            setupNotifications();
            
            console.log('Admin dashboard initialized successfully');
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showNotification('Error initializing dashboard. Some features may not work.', 'error');
        }
    }
    
    // Load dashboard statistics
    async function loadDashboardStats() {
        console.log('Loading dashboard statistics...');
        
        try {
            // Load pending events
            let pendingEvents = [];
            try {
                console.log('Fetching pending events...');
                const pendingEventsResponse = await fetch('/.netlify/functions/get-pending-items');
                if (!pendingEventsResponse.ok) {
                    throw new Error(`HTTP ${pendingEventsResponse.status}: ${pendingEventsResponse.statusText}`);
                }
                const eventsData = await pendingEventsResponse.json();
                
                // Ensure we have an array
                if (!Array.isArray(eventsData)) {
                    console.warn('Pending events is not an array:', eventsData);
                    pendingEvents = [];
                } else {
                    pendingEvents = eventsData;
                }
                
                console.log(`Loaded ${pendingEvents.length} pending events`);
            } catch (error) {
                console.error('Error loading pending events:', error);
                pendingEvents = [];
            }
            
            // Load pending venues (with fallback)
            let pendingVenues = [];
            try {
                console.log('Fetching pending venues...');
                const pendingVenuesResponse = await fetch('/.netlify/functions/get-pending-venues');
                if (pendingVenuesResponse.ok) {
                    pendingVenues = await pendingVenuesResponse.json();
                    
                    // Ensure we have an array
                    if (!Array.isArray(pendingVenues)) {
                        console.warn('Pending venues is not an array:', pendingVenues);
                        pendingVenues = [];
                    }
                    
                    console.log(`Loaded ${pendingVenues.length} pending venues`);
                } else {
                    console.warn('Pending venues function returned error:', pendingVenuesResponse.status);
                    pendingVenues = [];
                }
            } catch (error) {
                console.warn('Pending venues function not available, using fallback:', error.message);
                pendingVenues = [];
            }
            
            // Load total counts (with fallbacks)
            let totalEvents = { count: 0 };
            let totalVenues = { count: 0 };
            
            try {
                console.log('Fetching events count...');
                const totalEventsResponse = await fetch('/.netlify/functions/get-events-count');
                if (totalEventsResponse.ok) {
                    totalEvents = await totalEventsResponse.json();
                    console.log(`Total events: ${totalEvents.count}`);
                } else {
                    console.warn('Events count function returned error:', totalEventsResponse.status);
                    totalEvents = { count: pendingEvents.length };
                }
            } catch (error) {
                console.warn('Events count function not available, using fallback:', error.message);
                totalEvents = { count: pendingEvents.length };
            }
            
            try {
                console.log('Fetching venues count...');
                const totalVenuesResponse = await fetch('/.netlify/functions/get-venues-count');
                if (totalVenuesResponse.ok) {
                    totalVenues = await totalVenuesResponse.json();
                    console.log(`Total venues: ${totalVenues.count}`);
                } else {
                    console.warn('Venues count function returned error:', totalVenuesResponse.status);
                    totalVenues = { count: pendingVenues.length };
                }
            } catch (error) {
                console.warn('Venues count function not available, using fallback:', error.message);
                totalVenues = { count: pendingVenues.length };
            }
            
            // Update dashboard data
            dashboardData.pendingEvents = pendingEvents.length || 0;
            dashboardData.pendingVenues = pendingVenues.length || 0;
            dashboardData.totalEvents = totalEvents.count || 0;
            dashboardData.totalVenues = totalVenues.count || 0;
            
            // Update UI
            updateDashboardStats();
            updateNotificationBadges();
            
            console.log('Dashboard statistics updated successfully');
            
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            showNotification('Error loading dashboard statistics. Check console for details.', 'error');
            
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
            console.log('Recent activity response status:', response.status);
            
            if (!response.ok) {
                console.error('Recent activity API error:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Recent activity error details:', errorText);
                displayRecentActivity([]);
                return;
            }
            
            const activity = await response.json();
            console.log('Recent activity data received:', activity);
            
            // Check if activity is an array
            if (!Array.isArray(activity)) {
                console.error('Recent activity is not an array:', activity);
                displayRecentActivity([]);
                return;
            }
            
            dashboardData.recentActivity = activity;
            displayRecentActivity(activity);
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
            // Show fallback message
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
            document.getElementById('gemini-model').value = settings.GEMINI_MODEL || '';
            document.getElementById('google-places-api-key').value = settings.GOOGLE_PLACES_API_KEY || '';
            document.getElementById('cloudinary-cloud-name').value = settings.CLOUDINARY_CLOUD_NAME || '';
            document.getElementById('cloudinary-api-key').value = settings.CLOUDINARY_API_KEY || '';
            document.getElementById('cloudinary-api-secret').value = settings.CLOUDINARY_API_SECRET || '';
            document.getElementById('airtable-personal-access-token').value = settings.AIRTABLE_PERSONAL_ACCESS_TOKEN || '';
            document.getElementById('airtable-base-id').value = settings.AIRTABLE_BASE_ID || '';
            
            // Populate recurring event settings
            document.getElementById('recurring-instances-approve').value = settings.RECURRING_INSTANCES_TO_APPROVE || '3';
            document.getElementById('recurring-instances-show').value = settings.RECURRING_INSTANCES_TO_SHOW || '6';
            
        } catch (error) {
            console.error('Error loading settings:', error);
            showNotification('Error loading settings', 'error');
        }
    }
    
    // Save settings
    async function saveSettings(formData) {
        try {
            const settings = {
                GEMINI_MODEL: formData.get('geminiModel'),
                GOOGLE_PLACES_API_KEY: formData.get('googlePlacesApiKey'),
                CLOUDINARY_CLOUD_NAME: formData.get('cloudinaryCloudName'),
                CLOUDINARY_API_KEY: formData.get('cloudinaryApiKey'),
                CLOUDINARY_API_SECRET: formData.get('cloudinaryApiSecret'),
                AIRTABLE_PERSONAL_ACCESS_TOKEN: formData.get('airtablePersonalAccessToken'),
                AIRTABLE_BASE_ID: formData.get('airtableBaseId'),
                RECURRING_INSTANCES_TO_APPROVE: formData.get('RECURRING_INSTANCES_TO_APPROVE'),
                RECURRING_INSTANCES_TO_SHOW: formData.get('RECURRING_INSTANCES_TO_SHOW')
            };
            
            const response = await fetch('/.netlify/functions/update-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings)
            });
            
            if (response.ok) {
                showNotification('Settings saved successfully!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Error saving settings: ' + error.message, 'error');
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
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(settingsForm);
            await saveSettings(formData);
        });
    }
    
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
    
    // Debug functions for troubleshooting
    window.testRecurringEvents = async function() {
        console.log('Testing recurring events API...');
        try {
            const response = await fetch('/.netlify/functions/get-recurring-events');
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Recurring events data:', data);
            return data;
        } catch (error) {
            console.error('Error testing recurring events:', error);
            return null;
        }
    };

    window.testAirtableFields = async function() {
        console.log('Testing Airtable fields...');
        try {
            const response = await fetch('/.netlify/functions/debug-airtable-fields');
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Airtable fields data:', data);
            return data;
        } catch (error) {
            console.error('Error testing Airtable fields:', error);
            return null;
        }
    };

    window.testRecentActivity = async function() {
        console.log('Testing recent activity API...');
        try {
            const response = await fetch('/.netlify/functions/get-recent-activity');
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Recent activity data:', data);
            return data;
        } catch (error) {
            console.error('Error testing recent activity:', error);
            return null;
        }
    };

    // Validate event-venue data relationships
    window.validateEventVenueData = async function() {
        try {
            console.log('Admin Dashboard: Starting event-venue data validation...');
            
            const response = await fetch('/.netlify/functions/validate-event-venue-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Admin Dashboard: Validation results:', result);
                
                // Display results in a modal or alert
                let message = `Data Validation Complete!\n\n`;
                message += `Total Events: ${result.summary.totalEvents}\n`;
                message += `Total Venues: ${result.summary.totalVenues}\n`;
                message += `Issues Found: ${result.summary.issuesFound}\n\n`;
                
                if (result.summary.issuesFound > 0) {
                    message += `Issues by Severity:\n`;
                    message += `- High: ${result.summary.issuesBySeverity.high}\n`;
                    message += `- Medium: ${result.summary.issuesBySeverity.medium}\n`;
                    message += `- Low: ${result.summary.issuesBySeverity.low}\n\n`;
                    
                    message += `Issues by Type:\n`;
                    Object.entries(result.summary.issuesByType).forEach(([type, count]) => {
                        message += `- ${type}: ${count}\n`;
                    });
                    
                    message += `\nCheck the browser console for detailed issue information.`;
                } else {
                    message += `✅ No data issues found! All event-venue relationships are consistent.`;
                }
                
                alert(message);
                
                // Log detailed issues to console
                if (result.issues && result.issues.length > 0) {
                    console.group('Detailed Validation Issues:');
                    result.issues.forEach((issue, index) => {
                        console.group(`Issue ${index + 1}: ${issue.issue}`);
                        console.log('Event:', issue.eventName);
                        console.log('Severity:', issue.severity);
                        if (issue.details) {
                            console.log('Details:', issue.details);
                        }
                        console.groupEnd();
                    });
                    console.groupEnd();
                }
                
            } else {
                const errorData = await response.text();
                console.error('Admin Dashboard: Validation failed:', response.status, errorData);
                alert(`Validation failed: ${response.status} - ${errorData}`);
            }
        } catch (error) {
            console.error('Admin Dashboard: Error during validation:', error);
            alert(`Validation error: ${error.message}`);
        }
    };

    // Test image fix for recurring events
    window.testImageFix = async function() {
        console.log('Testing image fix for recurring events...');
        try {
            const response = await fetch('/.netlify/functions/test-image-fix');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                alert('Test failed: ' + errorText);
                return null;
            }
            
            const data = await response.json();
            console.log('Image fix test results:', data);
            
            let message = `Image Fix Test Results:\n\n`;
            message += `Total Events Tested: ${data.summary.totalEvents}\n`;
            message += `Events With Images: ${data.summary.eventsWithImages}\n`;
            message += `Events Without Images: ${data.summary.eventsWithoutImages}\n\n`;
            
            if (data.results && data.results.length > 0) {
                message += `Detailed Results:\n`;
                data.results.forEach((result, index) => {
                    message += `${index + 1}. ${result.eventName}\n`;
                    message += `   Has Image: ${result.hasImage ? '✅' : '❌'}\n`;
                    if (result.finalImageUrl) {
                        message += `   Image URL: ${result.finalImageUrl.substring(0, 50)}...\n`;
                    }
                    message += '\n';
                });
            }
            
            alert(message);
            return data;
        } catch (error) {
            console.error('Error testing image fix:', error);
            alert('Test error: ' + error.message);
            return null;
        }
    };
});