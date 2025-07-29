document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Enhanced Admin Approvals loaded successfully!');
    
    // Enhanced Elements
    const loadingState = document.getElementById('loading-state');
    const approvalList = document.getElementById('approval-list');
    const noItemsMessage = document.getElementById('no-items-message');
    const totalPendingCount = document.getElementById('total-pending-count');
    const pendingEventsCount = document.getElementById('pending-events-count');
    const pendingVenuesCount = document.getElementById('pending-venues-count');
    const recurringEventsCount = document.getElementById('recurring-events-count');
    const refreshBtn = document.getElementById('refresh-btn');
    const autoRefreshCheckbox = document.getElementById('auto-refresh');
    const compactViewCheckbox = document.getElementById('compact-view');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const bulkApproveBtn = document.getElementById('bulk-approve-btn');
    
    // Filter buttons
    const filterAll = document.getElementById('filter-all');
    const filterEvents = document.getElementById('filter-events');
    const filterVenues = document.getElementById('filter-venues');
    const filterRecurring = document.getElementById('filter-recurring');
    
    // Enhanced State Management
    let allItems = [];
    let filteredItems = [];
    let selectedItems = new Set();
    let currentFilter = 'all';
    let currentSort = 'newest';
    let searchQuery = '';
    let isCompactView = false;
    let autoRefreshInterval;
    let lastRefreshTime = Date.now();
    let isLoading = false;
    
    // Initialize
    initializeApprovals();
    
    async function initializeApprovals() {
        console.log('🚀 Initializing enhanced approvals system...');
        await loadPendingItems();
        setupEventListeners();
        setupAutoRefresh();
        setupSearch();
        setupSorting();
        updateBulkActions();
    }
    
    async function loadPendingItems() {
        if (isLoading) return;
        
        try {
            isLoading = true;
            showLoadingState();
            
            console.log('🔍 Loading pending items...');
            const response = await fetch('/.netlify/functions/get-pending-items-firestore');
            
            if (response.ok) {
                const data = await response.json();
                allItems = data.items || [];
                console.log(`📊 Loaded ${allItems.length} pending items`);
                
                // Reset selections when data changes
                selectedItems.clear();
                
                // Apply current filters and sorting
                applyFiltersAndSorting();
                updateDashboardStats();
                displayItems();
                
                showNotification(`Loaded ${allItems.length} pending items`, 'success');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Error loading pending items:', error);
            showNotification(`Error loading items: ${error.message}`, 'error');
            allItems = [];
            displayItems();
        } finally {
            isLoading = false;
            hideLoadingState();
        }
    }
    
    function showLoadingState() {
        loadingState.classList.remove('hidden');
        approvalList.classList.add('hidden');
        noItemsMessage.classList.add('hidden');
    }
    
    function hideLoadingState() {
        loadingState.classList.add('hidden');
    }
    
    function updateDashboardStats() {
        const events = allItems.filter(item => item.type === 'event');
        const venues = allItems.filter(item => item.type === 'venue');
        const recurring = allItems.filter(item => 
            item.type === 'event' && (item.recurringInfo || item.series)
        );
        
        totalPendingCount.textContent = allItems.length;
        pendingEventsCount.textContent = events.length;
        pendingVenuesCount.textContent = venues.length;
        recurringEventsCount.textContent = recurring.length;
        
        // Add loading animation to stats
        [totalPendingCount, pendingEventsCount, pendingVenuesCount, recurringEventsCount].forEach(el => {
            el.classList.add('loading-pulse');
            setTimeout(() => el.classList.remove('loading-pulse'), 1000);
        });
    }
    
    function applyFiltersAndSorting() {
        console.log('🔍 Applying filters and sorting...');
        
        // Apply search filter
        let filtered = allItems;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                item.name?.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query) ||
                item.venue?.name?.toLowerCase().includes(query) ||
                item.submittedBy?.toLowerCase().includes(query)
            );
        }
        
        // Apply type filter
        switch (currentFilter) {
            case 'events':
                filtered = filtered.filter(item => item.type === 'event');
                break;
            case 'venues':
                filtered = filtered.filter(item => item.type === 'venue');
                break;
            case 'recurring':
                filtered = filtered.filter(item => 
                    item.type === 'event' && (item.recurringInfo || item.series)
                );
                break;
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
            switch (currentSort) {
                case 'newest':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'name':
                    return (a.name || '').localeCompare(b.name || '');
                case 'type':
                    return a.type.localeCompare(b.type);
                default:
                    return 0;
            }
        });
        
        filteredItems = filtered;
        console.log(`📊 Filtered to ${filteredItems.length} items`);
    }
    
    function displayItems() {
        if (filteredItems.length === 0) {
            showEmptyState();
            return;
        }
        
        approvalList.classList.remove('hidden');
        noItemsMessage.classList.add('hidden');
        
        const itemsHtml = filteredItems.map(item => createEnhancedItemCard(item)).join('');
        approvalList.innerHTML = itemsHtml;
        
        attachItemEventListeners();
        updateBulkActions();
    }
    
    function showEmptyState() {
        approvalList.classList.add('hidden');
        noItemsMessage.classList.remove('hidden');
        
        const message = searchQuery.trim() ? 
            `No items found matching "${searchQuery}"` : 
            'No pending items to review';
        
        noItemsMessage.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h3 class="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
                <p class="text-gray-400">${message}</p>
                ${searchQuery.trim() ? `
                    <button onclick="clearSearch()" class="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <i class="fas fa-times mr-2"></i>Clear Search
                    </button>
                ` : ''}
            </div>
        `;
    }
    
    function createEnhancedItemCard(item) {
        const isSelected = selectedItems.has(item.id);
        const isRecurring = item.type === 'event' && (item.recurringInfo || item.series);
        const compactClass = isCompactView ? 'compact' : '';
        const selectedClass = isSelected ? 'selected' : '';
        
        const statusBadge = getStatusBadge(item.status);
        const categoryBadges = (item.category || []).map(cat => 
            `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full mr-1 mb-1">${cat}</span>`
        ).join('');
        
        const venueInfo = item.venue ? `
            <div class="approval-card-detail-item">
                <div class="detail-label">Venue</div>
                <div class="detail-value">${item.venue.name || 'Unknown'}</div>
            </div>
        ` : '';
        
        const dateInfo = item.date ? `
            <div class="approval-card-detail-item">
                <div class="detail-label">Event Date</div>
                <div class="detail-value">${formatDate(item.date)}</div>
            </div>
        ` : '';
        
        const descriptionInfo = item.description ? `
            <div class="approval-card-detail-item">
                <div class="detail-label">Description</div>
                <div class="detail-value expandable">${item.description}</div>
            </div>
        ` : '';
        
        const recurringInfo = isRecurring ? `
            <div class="approval-card-detail-item">
                <div class="detail-label">Recurring Pattern</div>
                <div class="detail-value text-purple-300">
                    <i class="fas fa-redo mr-2"></i>${item.recurringInfo || 'Series event'}
                </div>
            </div>
        ` : '';
        
        const submittedInfo = item.submittedBy ? `
            <div class="approval-card-detail-item">
                <div class="detail-label">Submitted By</div>
                <div class="detail-value">${item.submittedBy}</div>
            </div>
        ` : '';
        
        const createdAtInfo = item.createdAt ? `
            <div class="approval-card-detail-item">
                <div class="detail-label">Submitted</div>
                <div class="detail-value">${formatDate(item.createdAt)}</div>
            </div>
        ` : '';
        
        return `
            <div class="approval-card ${compactClass} ${selectedClass}" data-id="${item.id}" data-type="${item.type}">
                <input type="checkbox" class="selection-checkbox" ${isSelected ? 'checked' : ''} data-id="${item.id}">
                
                <div class="approval-card-header">
                    <div class="flex items-start space-x-3 flex-1 min-w-0">
                        <div class="text-2xl ${item.type === 'event' ? 'text-blue-400' : 'text-green-400'} flex-shrink-0 mt-1">
                            <i class="${item.type === 'event' ? 'fas fa-calendar' : 'fas fa-map-marker-alt'}"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-xl font-bold text-white truncate">${item.name}</h3>
                            <div class="flex items-center gap-2 mt-2">
                                ${statusBadge}
                                <span class="text-sm text-gray-400">${item.type}</span>
                                ${isRecurring ? '<span class="text-sm text-purple-400"><i class="fas fa-redo mr-1"></i>Recurring</span>' : ''}
                            </div>
                            ${categoryBadges ? `<div class="mt-2">${categoryBadges}</div>` : ''}
                        </div>
                    </div>
                    <div class="text-sm text-gray-400 flex-shrink-0">
                        ${formatDate(item.createdAt)}
                    </div>
                </div>
                
                <div class="approval-card-details">
                    ${venueInfo}
                    ${dateInfo}
                    ${descriptionInfo}
                    ${recurringInfo}
                    ${submittedInfo}
                    ${createdAtInfo}
                </div>
                
                <div class="approval-card-actions">
                    <button class="button-edit edit-btn" data-id="${item.id}" data-type="${item.type}">
                        <i class="fas fa-edit mr-2"></i>Edit
                    </button>
                    <button class="button-approve approve-btn" data-id="${item.id}" data-type="${item.type}">
                        <i class="fas fa-check mr-2"></i>Approve
                    </button>
                    <button class="button-reject reject-btn" data-id="${item.id}" data-type="${item.type}">
                        <i class="fas fa-times mr-2"></i>Reject
                    </button>
                </div>
            </div>
        `;
    }
    
    function attachItemEventListeners() {
        // Selection checkboxes
        document.querySelectorAll('.selection-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const itemId = e.target.dataset.id;
                if (e.target.checked) {
                    selectedItems.add(itemId);
                    e.target.closest('.approval-card').classList.add('selected');
                } else {
                    selectedItems.delete(itemId);
                    e.target.closest('.approval-card').classList.remove('selected');
                }
                updateBulkActions();
            });
        });
        
        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                const type = e.target.closest('button').dataset.type;
                openEditModal(id, type);
            });
        });
        
        // Approve buttons
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.target.closest('button');
                const id = button.dataset.id;
                const type = button.dataset.type;
                
                // Show loading state
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Approving...';
                button.disabled = true;
                
                try {
                    await approveItem(id, type);
                } finally {
                    // Restore button state
                    button.innerHTML = originalText;
                    button.disabled = false;
                }
            });
        });
        
        // Reject buttons
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                const type = e.target.closest('button').dataset.type;
                openRejectionModal(id, type);
            });
        });
    }
    
    async function approveItem(id, type) {
        try {
            console.log(`✅ APPROVE: Starting approval for ${type} ${id}`);
            
            const endpoint = 'update-item-status-firestore-only';
            const requestBody = {
                itemId: id,
                newStatus: 'approved',
                itemType: type
            };
            
            const response = await fetch(`/.netlify/functions/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification(`${type === 'event' ? 'Event' : 'Venue'} approved successfully!`, 'success');
                
                // Remove from arrays and selections
                allItems = allItems.filter(item => item.id !== id);
                selectedItems.delete(id);
                
                applyFiltersAndSorting();
                updateDashboardStats();
                displayItems();
            } else {
                throw new Error(`Failed to approve: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ APPROVE: Error:', error);
            showNotification(`Error approving ${type}: ${error.message}`, 'error');
        }
    }
    
    function openRejectionModal(id, type) {
        const modal = document.getElementById('rejection-modal');
        const confirmBtn = document.getElementById('confirm-rejection-btn');
        const cancelBtn = document.getElementById('cancel-rejection-btn');
        const reasonTextarea = document.getElementById('rejection-reason');
        
        reasonTextarea.value = '';
        confirmBtn.dataset.id = id;
        confirmBtn.dataset.type = type;
        
        modal.classList.remove('hidden');
        setTimeout(() => reasonTextarea.focus(), 100);
        
        const handleRejection = async () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                showNotification('Please provide a reason for rejection', 'error');
                return;
            }
            
            const originalText = confirmBtn.innerHTML;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Rejecting...';
            confirmBtn.disabled = true;
            
            try {
                await rejectItem(id, type, reason);
                modal.classList.add('hidden');
            } finally {
                confirmBtn.innerHTML = originalText;
                confirmBtn.disabled = false;
            }
        };
        
        const handleCancel = () => modal.classList.add('hidden');
        
        confirmBtn.removeEventListener('click', handleRejection);
        cancelBtn.removeEventListener('click', handleCancel);
        confirmBtn.addEventListener('click', handleRejection);
        cancelBtn.addEventListener('click', handleCancel);
    }
    
    async function rejectItem(id, type, reason) {
        try {
            console.log(`🔄 REJECT: Starting rejection for ${type} ${id}`);
            
            const response = await fetch('/.netlify/functions/update-item-status-firestore-only', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: id,
                    newStatus: 'rejected',
                    itemType: type,
                    reason: reason
                })
            });
            
            if (response.ok) {
                showNotification(`${type === 'event' ? 'Event' : 'Venue'} rejected successfully!`, 'success');
                
                // Remove from arrays and selections
                allItems = allItems.filter(item => item.id !== id);
                selectedItems.delete(id);
                
                applyFiltersAndSorting();
                updateDashboardStats();
                displayItems();
            } else {
                throw new Error(`Failed to reject: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ REJECT: Error:', error);
            showNotification(`Error rejecting ${type}: ${error.message}`, 'error');
        }
    }
    
    function setupEventListeners() {
        // Filter buttons
        filterAll.addEventListener('click', () => setFilter('all'));
        filterEvents.addEventListener('click', () => setFilter('events'));
        filterVenues.addEventListener('click', () => setFilter('venues'));
        filterRecurring.addEventListener('click', () => setFilter('recurring'));
        
        // Refresh button
        refreshBtn.addEventListener('click', loadPendingItems);
        
        // Auto-refresh checkbox
        autoRefreshCheckbox.addEventListener('change', setupAutoRefresh);
        
        // Compact view checkbox
        compactViewCheckbox.addEventListener('change', (e) => {
            isCompactView = e.target.checked;
            approvalList.classList.toggle('compact-view', isCompactView);
            displayItems();
        });
        
        // Bulk approve button
        bulkApproveBtn.addEventListener('click', handleBulkApprove);
        
        // Modal close buttons
        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
            document.getElementById('edit-modal').classList.add('hidden');
        });
        
        document.getElementById('cancel-rejection-btn')?.addEventListener('click', () => {
            document.getElementById('rejection-modal').classList.add('hidden');
        });
        
        document.getElementById('cancel-recurring-approval-btn')?.addEventListener('click', () => {
            document.getElementById('recurring-approval-modal').classList.add('hidden');
        });
        
        document.getElementById('confirm-recurring-approval-btn')?.addEventListener('click', handleRecurringApproval);
    }
    
    function setupSearch() {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchQuery = e.target.value;
                applyFiltersAndSorting();
                displayItems();
            }, 300);
        });
    }
    
    function setupSorting() {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applyFiltersAndSorting();
            displayItems();
        });
    }
    
    function setFilter(filter) {
        currentFilter = filter;
        
        // Update active button
        [filterAll, filterEvents, filterVenues, filterRecurring].forEach(btn => 
            btn.classList.remove('active')
        );
        document.getElementById(`filter-${filter}`).classList.add('active');
        
        applyFiltersAndSorting();
        displayItems();
    }
    
    function setupAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        
        if (autoRefreshCheckbox.checked) {
            autoRefreshInterval = setInterval(loadPendingItems, 30000);
            showNotification('Auto-refresh enabled (30s interval)', 'info');
        } else {
            showNotification('Auto-refresh disabled', 'info');
        }
    }
    
    function updateBulkActions() {
        const hasSelection = selectedItems.size > 0;
        bulkApproveBtn.disabled = !hasSelection;
        
        if (hasSelection) {
            bulkApproveBtn.innerHTML = `<i class="fas fa-check-double mr-2"></i>Approve ${selectedItems.size} Items`;
        } else {
            bulkApproveBtn.innerHTML = `<i class="fas fa-check-double mr-2"></i>Bulk Approve`;
        }
    }
    
    async function handleBulkApprove() {
        if (selectedItems.size === 0) return;
        
        const confirmed = confirm(`Are you sure you want to approve ${selectedItems.size} items?`);
        if (!confirmed) return;
        
        const originalText = bulkApproveBtn.innerHTML;
        bulkApproveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Approving...';
        bulkApproveBtn.disabled = true;
        
        try {
            let successCount = 0;
            let errorCount = 0;
            
            for (const itemId of selectedItems) {
                const item = allItems.find(i => i.id === itemId);
                if (item) {
                    try {
                        await approveItem(itemId, item.type);
                        successCount++;
                    } catch (error) {
                        errorCount++;
                        console.error(`Failed to approve ${itemId}:`, error);
                    }
                }
            }
            
            if (successCount > 0) {
                showNotification(`Successfully approved ${successCount} items${errorCount > 0 ? `, ${errorCount} failed` : ''}`, 'success');
            }
            if (errorCount > 0) {
                showNotification(`${errorCount} items failed to approve`, 'error');
            }
        } finally {
            bulkApproveBtn.innerHTML = originalText;
            bulkApproveBtn.disabled = false;
        }
    }
    
    function clearSearch() {
        searchInput.value = '';
        searchQuery = '';
        applyFiltersAndSorting();
        displayItems();
    }
    
    function getStatusBadge(status) {
        const statusClass = status === 'pending' ? 'pending' : 'approved';
        return `<span class="status-badge ${statusClass}">${status}</span>`;
    }
    
    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-toast notification-${type}`;
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });
    
    // Global function for clear search
    window.clearSearch = clearSearch;
});