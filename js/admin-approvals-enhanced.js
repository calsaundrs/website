document.addEventListener('DOMContentLoaded', () => {
    console.log('Enhanced Admin Approvals loaded successfully!');
    
    // Elements
    const loadingState = document.getElementById('loading-state');
    const approvalList = document.getElementById('approval-list');
    const noItemsMessage = document.getElementById('no-items-message');
    const totalPendingCount = document.getElementById('total-pending-count');
    const pendingEventsCount = document.getElementById('pending-events-count');
    const pendingVenuesCount = document.getElementById('pending-venues-count');
    const refreshBtn = document.getElementById('refresh-btn');
    const autoRefreshCheckbox = document.getElementById('auto-refresh');
    
    // Filter buttons
    const filterAll = document.getElementById('filter-all');
    const filterEvents = document.getElementById('filter-events');
    const filterVenues = document.getElementById('filter-venues');
    
    // State
    let allItems = [];
    let filteredItems = [];
    let currentFilter = 'all';
    let autoRefreshInterval;
    let lastRefreshTime = Date.now();
    
    // Initialize
    initializeApprovals();
    
    async function initializeApprovals() {
        await loadPendingItems();
        setupEventListeners();
        setupAutoRefresh();
    }
    
    async function loadPendingItems() {
        try {
            loadingState.classList.remove('hidden');
            approvalList.classList.add('hidden');
            noItemsMessage.classList.add('hidden');
            
            // Load both events and venues with error handling
            let events = [];
            let venues = [];
            
            try {
                const response = await fetch('/.netlify/functions/get-pending-items-firestore');
                if (response.ok) {
                    const data = await response.json();
                    // The function returns {items: [...], totalCount: ..., hasMore: ..., filters: {...}}
                    allItems = data.items || [];
                    console.log(`Loaded ${allItems.length} pending items (${allItems.filter(item => item.type === 'event').length} events, ${allItems.filter(item => item.type === 'venue').length} venues)`);
                } else {
                    console.error('Response not ok:', response.status);
                    allItems = [];
                }
            } catch (error) {
                console.error('Error loading pending items:', error);
                showNotification('Error loading pending items', 'error');
                allItems = [];
            }
            
            // Sort by creation date (newest first)
            allItems.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.submittedAt || a.date);
                const dateB = new Date(b.createdAt || b.submittedAt || b.date);
                return dateB - dateA;
            });
            
            updateDashboardStats();
            applyFilter();
            
        } catch (error) {
            console.error('Error loading pending items:', error);
            showNotification('Error loading pending items', 'error');
        } finally {
            loadingState.classList.add('hidden');
        }
    }
    
    function updateDashboardStats() {
        const events = allItems.filter(item => item.type === 'event');
        const venues = allItems.filter(item => item.type === 'venue');
        
        totalPendingCount.textContent = allItems.length;
        pendingEventsCount.textContent = events.length;
        pendingVenuesCount.textContent = venues.length;
        
        // Update last refresh time
        lastRefreshTime = Date.now();
    }
    
    function applyFilter() {
        switch (currentFilter) {
            case 'events':
                filteredItems = allItems.filter(item => item.type === 'event');
                break;
            case 'venues':
                filteredItems = allItems.filter(item => item.type === 'venue');
                break;
            default:
                filteredItems = allItems;
        }
        
        displayItems();
    }
    
    function displayItems() {
        if (filteredItems.length === 0) {
            approvalList.classList.add('hidden');
            noItemsMessage.classList.remove('hidden');
            return;
        }
        
        approvalList.classList.remove('hidden');
        noItemsMessage.classList.add('hidden');
        
        const itemsHtml = filteredItems.map(item => createItemCard(item)).join('');
        approvalList.innerHTML = itemsHtml;
        
        // Re-attach event listeners to new elements
        attachItemEventListeners();
    }
    
    function createItemCard(item) {
        const isEvent = item.type === 'event';
        
        // Use direct properties instead of fields object for Firestore data
        const title = isEvent ? item.name : item.name;
        const description = item.description || 'No description provided';
        const contactEmail = item.submittedBy || 'No email provided';
        const date = isEvent ? item.date : (item.createdAt || item.submittedAt);
        const formattedDate = date ? new Date(date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : 'Date not specified';
        
        const icon = isEvent ? 'fas fa-calendar' : 'fas fa-map-marker-alt';
        const typeLabel = isEvent ? 'Event' : 'Venue';
        const typeColor = isEvent ? 'text-blue-400' : 'text-green-400';
        
        // Check if description is long enough to be expandable
        const isLongDescription = description.length > 150;
        const descriptionClass = isLongDescription ? 'detail-value expandable' : 'detail-value';
        
        return `
            <div class="approval-card" data-id="${item.id}" data-type="${item.type}">
                <div class="approval-card-header">
                    <div class="flex items-start space-x-3 flex-1 min-w-0">
                        <div class="text-2xl ${typeColor} flex-shrink-0 mt-1">
                            <i class="${icon}"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-xl font-bold text-white truncate">${title}</h3>
                            <span class="inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full mt-1">${typeLabel}</span>
                        </div>
                    </div>
                    <div class="text-sm text-gray-400 flex-shrink-0">
                        Submitted: ${formattedDate}
                    </div>
                </div>
                
                <div class="approval-card-details">
                    <div class="approval-card-detail-item">
                        <p class="detail-label">Description</p>
                        <p class="${descriptionClass}" title="${isLongDescription ? 'Click to expand' : ''}">${description}</p>
                    </div>
                    
                    ${isEvent ? `
                        <div class="approval-card-detail-item">
                            <p class="detail-label">Event Date</p>
                            <p class="detail-value">${formattedDate}</p>
                        </div>
                        
                        ${item.category && item.category.length > 0 ? `
                            <div class="approval-card-detail-item">
                                <p class="detail-label">Category</p>
                                <p class="detail-value">${Array.isArray(item.category) ? item.category.join(', ') : item.category}</p>
                            </div>
                        ` : ''}
                        
                        ${item.venue && item.venue.name ? `
                            <div class="approval-card-detail-item">
                                <p class="detail-label">Venue</p>
                                <p class="detail-value">${item.venue.name}</p>
                            </div>
                        ` : ''}
                        
                        ${item.recurringInfo ? `
                            <div class="approval-card-detail-item">
                                <p class="detail-label">Recurring Pattern</p>
                                <p class="detail-value">${item.recurringInfo}</p>
                            </div>
                        ` : ''}
                        
                        ${item.series ? `
                            <div class="approval-card-detail-item">
                                <p class="detail-label">Series Info</p>
                                <p class="detail-value">Series Event</p>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="approval-card-detail-item">
                            <p class="detail-label">Address</p>
                            <p class="detail-value">${item.address || 'No address provided'}</p>
                        </div>
                        
                        ${item.website ? `
                            <div class="approval-card-detail-item">
                                <p class="detail-label">Website</p>
                                <p class="detail-value">${item.website}</p>
                            </div>
                        ` : ''}
                    `}
                    
                    <div class="approval-card-detail-item">
                        <p class="detail-label">Contact Email</p>
                        <p class="detail-value">${contactEmail}</p>
                    </div>
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
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('button').dataset.id;
                const type = e.target.closest('button').dataset.type;
                approveItem(id, type);
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
            // Check if this is a recurring event
            const item = allItems.find(item => item.id === id && item.type === type);
            
            if (type === 'event' && item && item.fields['Series ID']) {
                // Show recurring approval modal
                openRecurringApprovalModal(id, type);
                return;
            }
            
            // Regular approval for non-recurring events or venues
            const endpoint = 'update-item-status-firestore-only';
            const response = await fetch(`/.netlify/functions/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: id,
                    status: 'Approved',
                    type: type
                })
            });
            
            if (response.ok) {
                showNotification(`${type === 'event' ? 'Event' : 'Venue'} approved successfully!`, 'success');
                await loadPendingItems(); // Refresh the list
            } else {
                throw new Error('Failed to approve item');
            }
        } catch (error) {
            console.error('Error approving item:', error);
            showNotification('Error approving item', 'error');
        }
    }

    function openRecurringApprovalModal(id, type) {
        const modal = document.getElementById('recurring-approval-modal');
        modal.classList.remove('hidden');
        
        // Store the current item being approved
        modal.dataset.itemId = id;
        modal.dataset.itemType = type;
        
        // Reset radio buttons
        document.getElementById('approve-series').checked = true;
    }

    async function handleRecurringApproval() {
        const modal = document.getElementById('recurring-approval-modal');
        const id = modal.dataset.itemId;
        const type = modal.dataset.itemType;
        const approvalType = document.querySelector('input[name="approval-type"]:checked').value;
        
        try {
            const response = await fetch('/.netlify/functions/approve-recurring-series', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eventId: id,
                    approveFutureInstances: approvalType === 'series'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification(result.message, 'success');
                modal.classList.add('hidden');
                await loadPendingItems(); // Refresh the list
            } else {
                throw new Error('Failed to approve recurring series');
            }
        } catch (error) {
            console.error('Error approving recurring series:', error);
            showNotification('Error approving recurring series', 'error');
        }
    }
    
    function openRejectionModal(id, type) {
        const modal = document.getElementById('rejection-modal');
        const confirmBtn = document.getElementById('confirm-rejection-btn');
        const cancelBtn = document.getElementById('cancel-rejection-btn');
        const reasonTextarea = document.getElementById('rejection-reason');
        
        // Clear previous reason
        reasonTextarea.value = '';
        
        // Store the item info for rejection
        confirmBtn.dataset.id = id;
        confirmBtn.dataset.type = type;
        
        modal.classList.remove('hidden');
        
        // Focus on textarea
        setTimeout(() => reasonTextarea.focus(), 100);
        
        // Event listeners
        const handleRejection = async () => {
            const reason = reasonTextarea.value.trim();
            if (!reason) {
                showNotification('Please provide a reason for rejection', 'error');
                return;
            }
            
            await rejectItem(id, type, reason);
            modal.classList.add('hidden');
        };
        
        const handleCancel = () => {
            modal.classList.add('hidden');
        };
        
        // Remove previous listeners
        confirmBtn.removeEventListener('click', handleRejection);
        cancelBtn.removeEventListener('click', handleCancel);
        
        // Add new listeners
        confirmBtn.addEventListener('click', handleRejection);
        cancelBtn.addEventListener('click', handleCancel);
    }
    
    async function rejectItem(id, type, reason) {
        try {
            const endpoint = 'update-item-status-firestore-only';
            const response = await fetch(`/.netlify/functions/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: id,
                    status: 'Rejected',
                    reason: reason,
                    type: type
                })
            });
            
            if (response.ok) {
                showNotification(`${type === 'event' ? 'Event' : 'Venue'} rejected successfully!`, 'success');
                await loadPendingItems(); // Refresh the list
            } else {
                throw new Error('Failed to reject item');
            }
            
        } catch (error) {
            console.error('Error rejecting item:', error);
            showNotification('Error rejecting item', 'error');
        }
    }
    
    function openEditModal(id, type) {
        const modal = document.getElementById('edit-modal');
        const form = document.getElementById('edit-form');
        const fieldsContainer = document.getElementById('edit-form-fields');
        
        // Find the item
        const item = allItems.find(item => item.id === id);
        if (!item) {
            showNotification('Item not found', 'error');
            return;
        }
        
        // Populate form fields based on type
        fieldsContainer.innerHTML = createEditFormFields(item);
        
        modal.classList.remove('hidden');
        
        // Handle form submission
        const handleSubmit = async (e) => {
            e.preventDefault();
            await saveEditForm(id, type, form);
            modal.classList.add('hidden');
        };
        
        // Remove previous listener and add new one
        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    }
    
    function createEditFormFields(item) {
        const fields = item.fields;
        const isEvent = item.type === 'event';
        
        if (isEvent) {
            return `
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Event Name</label>
                    <input type="text" name="event-name" value="${fields['Event Name'] || ''}" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                </div>
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Description</label>
                    <textarea name="description" rows="4" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">${fields.Description || ''}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Date</label>
                    <input type="datetime-local" name="date" value="${fields.Date ? new Date(fields.Date).toISOString().slice(0, 16) : ''}" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                </div>
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Category</label>
                    <input type="text" name="category" value="${Array.isArray(fields.Category) ? fields.Category.join(', ') : fields.Category || ''}" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                </div>
            `;
        } else {
            return `
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Venue Name</label>
                    <input type="text" name="name" value="${fields.Name || ''}" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                </div>
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Description</label>
                    <textarea name="description" rows="4" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">${fields.Description || ''}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Address</label>
                    <input type="text" name="address" value="${fields.Address || ''}" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                </div>
                <div>
                    <label class="block text-sm font-semibold mb-2 accent-color-secondary">Website</label>
                    <input type="url" name="website" value="${fields.Website || ''}" class="w-full p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                </div>
            `;
        }
    }
    
    async function saveEditForm(id, type, form) {
        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            const endpoint = 'update-item-status-firestore-only';
            const response = await fetch(`/.netlify/functions/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: id,
                    ...data,
                    type: type
                })
            });
            
            if (response.ok) {
                showNotification(`${type === 'event' ? 'Event' : 'Venue'} updated successfully!`, 'success');
                await loadPendingItems(); // Refresh the list
            } else {
                throw new Error('Failed to update item');
            }
            
        } catch (error) {
            console.error('Error updating item:', error);
            showNotification('Error updating item', 'error');
        }
    }
    
    function setupEventListeners() {
        // Filter buttons
        filterAll.addEventListener('click', () => setFilter('all'));
        filterEvents.addEventListener('click', () => setFilter('events'));
        filterVenues.addEventListener('click', () => setFilter('venues'));
        
        // Refresh button
        refreshBtn.addEventListener('click', loadPendingItems);
        
        // Auto-refresh checkbox
        autoRefreshCheckbox.addEventListener('change', setupAutoRefresh);
        
        // Modal close buttons
        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            document.getElementById('edit-modal').classList.add('hidden');
        });
        
        document.getElementById('cancel-rejection-btn').addEventListener('click', () => {
            document.getElementById('rejection-modal').classList.add('hidden');
        });
        
        // Recurring approval modal
        document.getElementById('cancel-recurring-approval-btn').addEventListener('click', () => {
            document.getElementById('recurring-approval-modal').classList.add('hidden');
        });
        
        document.getElementById('confirm-recurring-approval-btn').addEventListener('click', handleRecurringApproval);
        
        // Close modals when clicking outside
        document.getElementById('recurring-approval-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                e.currentTarget.classList.add('hidden');
            }
        });
    }
    
    function setFilter(filter) {
        currentFilter = filter;
        
        // Update active button
        [filterAll, filterEvents, filterVenues].forEach(btn => btn.classList.remove('active'));
        document.getElementById(`filter-${filter}`).classList.add('active');
        
        applyFilter();
    }
    
    function setupAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
        
        if (autoRefreshCheckbox.checked) {
            autoRefreshInterval = setInterval(async () => {
                await loadPendingItems();
            }, 30000); // Refresh every 30 seconds
        }
    }
    
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-toast notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Hide and remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
    });
});