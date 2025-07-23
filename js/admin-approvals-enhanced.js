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
            
            // Load both events and venues
            const [eventsResponse, venuesResponse] = await Promise.all([
                fetch('/.netlify/functions/get-pending-items'),
                fetch('/.netlify/functions/get-pending-venues')
            ]);
            
            const events = await eventsResponse.json();
            const venues = await venuesResponse.json();
            
            // Combine and format items
            allItems = [
                ...events.map(item => ({ ...item, type: 'event' })),
                ...venues.map(item => ({ ...item, type: 'venue' }))
            ];
            
            // Sort by creation date (newest first)
            allItems.sort((a, b) => {
                const dateA = new Date(a.fields.Date || a.fields['Created Time'] || a.createdTime);
                const dateB = new Date(b.fields.Date || b.fields['Created Time'] || b.createdTime);
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
        const fields = item.fields;
        
        const title = isEvent ? fields['Event Name'] : fields.Name;
        const description = fields.Description || 'No description provided';
        const contactEmail = fields['Contact Email'] || fields['Submitter Email'] || 'No email provided';
        const date = isEvent ? fields.Date : fields['Created Time'];
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
        
        return `
            <div class="approval-card" data-id="${item.id}" data-type="${item.type}">
                <div class="approval-card-header">
                    <div class="flex items-center space-x-3">
                        <div class="text-2xl ${typeColor}">
                            <i class="${icon}"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-white">${title}</h3>
                            <span class="inline-block bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">${typeLabel}</span>
                        </div>
                    </div>
                    <div class="text-sm text-gray-400">
                        Submitted: ${formattedDate}
                    </div>
                </div>
                
                <div class="approval-card-details">
                    <div class="approval-card-detail-item">
                        <p class="text-gray-400 text-xs uppercase tracking-wide">Description</p>
                        <p class="text-white">${description}</p>
                    </div>
                    
                    ${isEvent ? `
                        <div class="approval-card-detail-item">
                            <p class="text-gray-400 text-xs uppercase tracking-wide">Event Date</p>
                            <p class="text-white">${formattedDate}</p>
                        </div>
                        
                        ${fields.Category ? `
                            <div class="approval-card-detail-item">
                                <p class="text-gray-400 text-xs uppercase tracking-wide">Category</p>
                                <p class="text-white">${Array.isArray(fields.Category) ? fields.Category.join(', ') : fields.Category}</p>
                            </div>
                        ` : ''}
                        
                        ${fields['Venue Name'] ? `
                            <div class="approval-card-detail-item">
                                <p class="text-gray-400 text-xs uppercase tracking-wide">Venue</p>
                                <p class="text-white">${Array.isArray(fields['Venue Name']) ? fields['Venue Name'][0] : fields['Venue Name']}</p>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="approval-card-detail-item">
                            <p class="text-gray-400 text-xs uppercase tracking-wide">Address</p>
                            <p class="text-white">${fields.Address || 'No address provided'}</p>
                        </div>
                        
                        ${fields.Website ? `
                            <div class="approval-card-detail-item">
                                <p class="text-gray-400 text-xs uppercase tracking-wide">Website</p>
                                <p class="text-white">${fields.Website}</p>
                            </div>
                        ` : ''}
                    `}
                    
                    <div class="approval-card-detail-item">
                        <p class="text-gray-400 text-xs uppercase tracking-wide">Contact Email</p>
                        <p class="text-white">${contactEmail}</p>
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
            const endpoint = type === 'event' ? 'update-submission-status' : 'update-item-status';
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
            const endpoint = type === 'event' ? 'update-submission-status' : 'update-item-status';
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
            
            const endpoint = type === 'event' ? 'update-submission' : 'update-item-status';
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