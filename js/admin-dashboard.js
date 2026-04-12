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
            setupRebuildVenues();
            setupRebuildEvents();

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
            // Import auth headers
            let authOptions = {};
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders();
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            // Load pending events
            let pendingEvents = [];
            try {
                console.log('Fetching pending events...');
                const pendingEventsResponse = await fetch('/.netlify/functions/get-pending-items', authOptions);
                if (!pendingEventsResponse.ok) {
                    throw new Error(`HTTP ${pendingEventsResponse.status}: ${pendingEventsResponse.statusText}`);
                }
                const eventsData = await pendingEventsResponse.json();

                // The function returns {items: [...], totalCount: ..., hasMore: ..., filters: {...}}
                if (eventsData && eventsData.items) {
                    pendingEvents = eventsData.items.filter(item => item.type === 'event');
                } else {
                    pendingEvents = [];
                }

                console.log(`Loaded ${pendingEvents.length} pending events`);
            } catch (error) {
                console.error('Error loading pending events:', error);
                pendingEvents = [];
            }

            // Load pending venues from the same function
            let pendingVenues = [];
            try {
                console.log('Fetching pending venues...');
                const pendingVenuesResponse = await fetch('/.netlify/functions/get-pending-items', authOptions);
                if (pendingVenuesResponse.ok) {
                    const venuesData = await pendingVenuesResponse.json();

                    // The function returns {items: [...], totalCount: ..., hasMore: ..., filters: {...}}
                    if (venuesData && venuesData.items) {
                        pendingVenues = venuesData.items.filter(item => item.type === 'venue');
                    } else {
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
            // Import auth headers
            let authOptions = {};
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders();
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const response = await fetch('/.netlify/functions/get-recent-activity', authOptions);
            const activity = await response.json();

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
            // Import auth headers
            let authOptions = {};
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders();
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const response = await fetch('/.netlify/functions/get-settings', authOptions);
            const settings = await response.json();

            // Populate form fields
            document.getElementById('gemini-model').value = settings.GEMINI_MODEL || '';
            document.getElementById('google-places-api-key').value = settings.GOOGLE_PLACES_API_KEY || '';
            document.getElementById('cloudinary-cloud-name').value = settings.CLOUDINARY_CLOUD_NAME || '';
            document.getElementById('cloudinary-api-key').value = settings.CLOUDINARY_API_KEY || '';
            document.getElementById('cloudinary-api-secret').value = settings.CLOUDINARY_API_SECRET || '';

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
            // Import auth headers
            let authOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders(authOptions);
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const settings = {
                GEMINI_MODEL: formData.get('geminiModel'),
                GOOGLE_PLACES_API_KEY: formData.get('googlePlacesApiKey'),
                CLOUDINARY_CLOUD_NAME: formData.get('cloudinaryCloudName'),
                CLOUDINARY_API_KEY: formData.get('cloudinaryApiKey'),
                CLOUDINARY_API_SECRET: formData.get('cloudinaryApiSecret'),
                RECURRING_INSTANCES_TO_APPROVE: formData.get('RECURRING_INSTANCES_TO_APPROVE'),
                RECURRING_INSTANCES_TO_SHOW: formData.get('RECURRING_INSTANCES_TO_SHOW')
            };

            const response = await fetch('/.netlify/functions/update-settings', {
                ...authOptions,
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
            // Import auth headers
            let authOptions = {};
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders();
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const response = await fetch('/.netlify/functions/get-pending-items', authOptions);
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

    // Setup rebuild venues functionality
    function setupRebuildVenues() {
        console.log('Setting up rebuild venues functionality...');
        const rebuildBtn = document.getElementById('rebuild-venues-btn');
        const rebuildStatus = document.getElementById('rebuild-status');

        console.log('Rebuild button found:', !!rebuildBtn);
        console.log('Rebuild status found:', !!rebuildStatus);

        // Load last rebuild time from localStorage
        const lastRebuildInfo = document.getElementById('last-rebuild-info');
        const lastRebuildTime = document.getElementById('last-rebuild-time');
        if (lastRebuildInfo && lastRebuildTime) {
            const lastRebuild = localStorage.getItem('lastVenueRebuild');
            if (lastRebuild) {
                try {
                    const rebuildData = JSON.parse(lastRebuild);
                    const rebuildDate = new Date(rebuildData.timestamp);
                    lastRebuildTime.textContent = `Last: ${rebuildDate.toLocaleString()}`;
                    lastRebuildInfo.classList.remove('hidden');
                } catch (error) {
                    console.warn('Error parsing last rebuild data:', error);
                }
            }
        }

        if (rebuildBtn) {
            console.log('Adding click listener to rebuild button...');
            rebuildBtn.addEventListener('click', async () => {
                try {
                    console.log('Rebuild button clicked!');
                    if (rebuildBtn.disabled) {
                        console.log('Button is disabled, returning');
                        return;
                    }

                    // Show confirmation dialog
                    console.log('Showing confirmation dialog...');
                    const confirmed = confirm('Are you sure you want to rebuild all venue pages? This will regenerate all static venue files with the latest data from the database.');
                    console.log('Confirmation result:', confirmed);

                    if (!confirmed) {
                        console.log('User cancelled rebuild');
                        return;
                    }

                    console.log('User confirmed rebuild, starting process...');

                    try {
                        // Show loading state
                        rebuildBtn.disabled = true;
                        rebuildStatus.classList.remove('hidden');
                        rebuildBtn.querySelector('.fa-sync-alt').classList.add('animate-spin');

                        showNotification('Starting venue rebuild process...', 'info');

                        // Call the rebuild function
                        console.log('Calling rebuild function...');

                        let authOptions = {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        };
                        try {
                            const authModule = await import('/js/auth-guard.js');
                            authOptions = await authModule.getAuthHeaders(authOptions);
                        } catch (e) {
                            console.warn('Auth module not available or failed:', e);
                        }

                        const response = await fetch('/.netlify/functions/build-venues-ssg', {
                            ...authOptions,
                            body: JSON.stringify({
                                action: 'rebuild',
                                source: 'admin-panel'
                            })
                        });

                        console.log('Rebuild response status:', response.status);

                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }

                        const result = await response.json();
                        console.log('Rebuild result:', result);

                        if (result.success) {
                            showNotification(`✅ Successfully rebuilt ${result.generatedFiles || 0} venue pages!`, 'success');

                            // Update last rebuild time
                            const lastRebuildInfo = document.getElementById('last-rebuild-info');
                            const lastRebuildTime = document.getElementById('last-rebuild-time');
                            if (lastRebuildInfo && lastRebuildTime) {
                                const now = new Date();
                                lastRebuildTime.textContent = `Last: ${now.toLocaleString()}`;
                                lastRebuildInfo.classList.remove('hidden');
                            }

                            // Store rebuild info in localStorage
                            localStorage.setItem('lastVenueRebuild', JSON.stringify({
                                timestamp: new Date().toISOString(),
                                filesGenerated: result.generatedFiles || 0,
                                source: result.source || 'admin-panel'
                            }));

                            // Add to recent activity
                            const activity = {
                                type: 'rebuild',
                                message: `Rebuilt ${result.generatedFiles || 0} venue pages`,
                                timestamp: new Date().toISOString(),
                                details: result
                            };

                            // Update recent activity display
                            if (recentActivity) {
                                const activityHtml = `
                                <div class="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                                    <div class="text-accent-color">
                                        <i class="fas fa-sync-alt"></i>
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-white font-medium">${activity.message}</p>
                                        <p class="text-gray-400 text-sm">${getTimeAgo(activity.timestamp)}</p>
                                    </div>
                                </div>
                            `;
                                recentActivity.insertAdjacentHTML('afterbegin', activityHtml);
                            }

                        } else {
                            throw new Error(result.error || 'Unknown error occurred');
                        }

                    } catch (error) {
                        console.error('Error rebuilding venues:', error);
                        showNotification(`❌ Failed to rebuild venues: ${error.message}`, 'error');
                    } finally {
                        // Reset button state
                        rebuildBtn.disabled = false;
                        rebuildStatus.classList.add('hidden');
                        rebuildBtn.querySelector('.fa-sync-alt').classList.remove('animate-spin');
                    }
                } catch (error) {
                    console.error('Unexpected error in rebuild button click handler:', error);
                    showNotification(`❌ Unexpected error: ${error.message}`, 'error');
                }
            });
        }
    }

    function setupRebuildEvents() {
        console.log('Setting up rebuild events functionality...');
        const rebuildBtn = document.getElementById('rebuild-events-btn');
        const rebuildStatus = document.getElementById('rebuild-events-status');

        console.log('Rebuild events button found:', !!rebuildBtn);
        console.log('Rebuild events status found:', !!rebuildStatus);

        // Load last rebuild time from localStorage
        const lastRebuildInfo = document.getElementById('last-rebuild-events-info');
        const lastRebuildTime = document.getElementById('last-rebuild-events-time');
        if (lastRebuildInfo && lastRebuildTime) {
            const lastRebuild = localStorage.getItem('lastEventRebuild');
            if (lastRebuild) {
                try {
                    const rebuildData = JSON.parse(lastRebuild);
                    const rebuildDate = new Date(rebuildData.timestamp);
                    lastRebuildTime.textContent = `Last: ${rebuildDate.toLocaleString()}`;
                    lastRebuildInfo.classList.remove('hidden');
                } catch (error) {
                    console.warn('Error parsing last event rebuild data:', error);
                }
            }
        }

        if (rebuildBtn) {
            console.log('Adding click listener to rebuild events button...');
            rebuildBtn.addEventListener('click', async () => {
                try {
                    console.log('Rebuild events button clicked!');
                    if (rebuildBtn.disabled) {
                        console.log('Button is disabled, returning');
                        return;
                    }

                    // Show confirmation dialog
                    console.log('Showing confirmation dialog...');
                    const confirmed = confirm('Are you sure you want to rebuild all event pages? This will regenerate all static event files with the latest data from the database.');
                    console.log('Confirmation result:', confirmed);

                    if (!confirmed) {
                        console.log('User cancelled rebuild');
                        return;
                    }

                    console.log('User confirmed rebuild, starting process...');

                    try {
                        // Show loading state
                        rebuildBtn.disabled = true;
                        rebuildStatus.classList.remove('hidden');
                        rebuildBtn.querySelector('.fa-calendar-alt').classList.add('animate-spin');

                        showNotification('Starting event rebuild process...', 'info');

                        // Call the rebuild function
                        console.log('Calling rebuild events function...');

                        let authOptions = {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        };
                        try {
                            const authModule = await import('/js/auth-guard.js');
                            authOptions = await authModule.getAuthHeaders(authOptions);
                        } catch (e) {
                            console.warn('Auth module not available or failed:', e);
                        }

                        const response = await fetch('/.netlify/functions/build-events-ssg', {
                            ...authOptions,
                            body: JSON.stringify({
                                action: 'rebuild',
                                source: 'admin-panel'
                            })
                        });

                        console.log('Rebuild events response status:', response.status);

                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }

                        const result = await response.json();
                        console.log('Rebuild events result:', result);

                        if (result.success) {
                            showNotification(`✅ Successfully rebuilt ${result.generatedFiles || 0} event pages!`, 'success');

                            // Update last rebuild time
                            const lastRebuildInfo = document.getElementById('last-rebuild-events-info');
                            const lastRebuildTime = document.getElementById('last-rebuild-events-time');
                            if (lastRebuildInfo && lastRebuildTime) {
                                const now = new Date();
                                lastRebuildTime.textContent = `Last: ${now.toLocaleString()}`;
                                lastRebuildInfo.classList.remove('hidden');
                            }

                            // Store rebuild info in localStorage
                            localStorage.setItem('lastEventRebuild', JSON.stringify({
                                timestamp: new Date().toISOString(),
                                filesGenerated: result.generatedFiles || 0,
                                source: result.source || 'admin-panel'
                            }));

                            // Add to recent activity
                            const activity = {
                                type: 'rebuild',
                                message: `Rebuilt ${result.generatedFiles || 0} event pages`,
                                timestamp: new Date().toISOString(),
                                details: result
                            };

                            // Update recent activity display
                            if (recentActivity) {
                                const activityHtml = `
                                <div class="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                                    <div class="text-accent-color">
                                        <i class="fas fa-calendar-alt"></i>
                                    </div>
                                    <div class="flex-1">
                                        <p class="text-white font-medium">${activity.message}</p>
                                        <p class="text-gray-400 text-sm">${getTimeAgo(activity.timestamp)}</p>
                                    </div>
                                </div>
                            `;
                                recentActivity.insertAdjacentHTML('afterbegin', activityHtml);
                            }

                        } else {
                            throw new Error(result.error || 'Unknown error occurred');
                        }

                    } catch (error) {
                        console.error('Error rebuilding events:', error);
                        showNotification(`❌ Failed to rebuild events: ${error.message}`, 'error');
                    } finally {
                        // Reset button state
                        rebuildBtn.disabled = false;
                        rebuildStatus.classList.add('hidden');
                        rebuildBtn.querySelector('.fa-calendar-alt').classList.remove('animate-spin');
                    }
                } catch (error) {
                    console.error('Unexpected error in rebuild events button click handler:', error);
                    showNotification(`❌ Unexpected error: ${error.message}`, 'error');
                }
            });
        }
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
});