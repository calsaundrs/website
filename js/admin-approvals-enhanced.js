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
    const filterPastRecurring = document.getElementById('filter-past-recurring');
    
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
    
    // Available categories for the form (matching promoter submission)
    const VALID_CATEGORIES = [
        "Comedy", "Drag", "Live Music", "Party", "Pride", "Social", "Theatre", 
        "Viewing Party", "Kink", "Community", "Exhibition", "Health", "Quiz", 
        "Trans & Non-Binary", "Sober", "Queer Women & Sapphic"
    ];
    
    // Initialize
    initializeApprovals();
    
    async function initializeApprovals() {
        console.log('🚀 Initializing enhanced approvals system...');
        await loadPendingItems();
        await loadVenues();
        setupEventListeners();
        setupAutoRefresh();
        setupSearch();
        setupSorting();
        updateBulkActions();
    }
    
    async function loadVenues() {
        try {
            console.log('🏢 Loading venues for edit form...');

            // Import auth headers
            let authOptions = {};
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders();
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const response = await fetch('/.netlify/functions/get-admin-venues', authOptions);
            
            if (response.ok) {
                const data = await response.json();
                window.allVenues = data || [];
                console.log(`🏢 Loaded ${window.allVenues.length} venues for edit form`);
            } else {
                console.error('❌ Failed to load venues:', response.status);
                window.allVenues = [];
            }
        } catch (error) {
            console.error('❌ Error loading venues:', error);
            window.allVenues = [];
        }
    }
    
    async function loadPendingItems() {
        if (isLoading) return;
        
        try {
            isLoading = true;
            showLoadingState();
            
            console.log('🔍 Loading pending items...');

            // Import auth headers
            let authOptions = {};
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders();
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const response = await fetch('/.netlify/functions/get-pending-items-firestore', authOptions);
            
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
        const pastRecurring = allItems.filter(item => 
            item.type === 'event' && 
            (item.recurringInfo || item.series) && 
            item.isPastEvent
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
        
        // Log stats for debugging
        console.log(`📊 Stats - Total: ${allItems.length}, Events: ${events.length}, Venues: ${venues.length}, Recurring: ${recurring.length}, Past Recurring: ${pastRecurring.length}`);
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
            case 'past-recurring':
                filtered = filtered.filter(item => 
                    item.type === 'event' && 
                    (item.recurringInfo || item.series) && 
                    item.isPastEvent
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
        const isRecurring = item.type === 'event' && (item.recurringInfo || item.series || item.isRecurring || 
                                                     item.recurringPattern || item.recurringGroupId || item.seriesId);
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
                    <i class="fas fa-redo mr-2"></i>${item.recurringInfo || item.recurringPattern || item.customRecurrenceDesc || 'Series event'}
                    ${item.isPastEvent ? '<span class="text-orange-400 ml-2">(Past event)</span>' : ''}
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
        
        // Image display
        const imageInfo = item.image && item.image.url ? `
            <div class="approval-card-detail-item">
                <div class="detail-label">Image</div>
                <div class="detail-value">
                    <img src="${item.image.url}" alt="${item.name}" class="w-32 h-20 object-cover rounded-lg border border-gray-600 hover:scale-105 transition-transform cursor-pointer" onclick="openImageModal('${item.image.url}', '${item.name}')">
                </div>
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
                                ${item.isPastEvent ? '<span class="text-sm text-orange-400"><i class="fas fa-clock mr-1"></i>Past</span>' : ''}
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
                    ${imageInfo}
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
            
            const endpoint = 'update-item-status';
            const requestBody = {
                itemId: id,
                newStatus: 'approved',
                itemType: type
            };
            
            // Import auth headers
            let authOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            };
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders(authOptions);
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const response = await fetch(`/.netlify/functions/${endpoint}`, {
                ...authOptions,
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
    
    function openEditModal(id, type) {
        const modal = document.getElementById('edit-modal');
        const modalTitle = document.getElementById('modal-title');
        
        // Find the item
        const item = allItems.find(item => item.id === id);
        if (!item) {
            showNotification('Item not found', 'error');
            return;
        }
        
        console.log(`✏️ EDIT: Opening edit modal for ${type} ${id}`, item);
        
        if (type === 'event') {
            modalTitle.innerHTML = '<i class="fas fa-edit mr-3"></i>Edit Event';
            populateEditForm(item);
        } else {
            modalTitle.innerHTML = '<i class="fas fa-edit mr-3"></i>Edit Venue';
            populateVenueEditForm(item);
        }
        
        modal.classList.remove('hidden');
    }
    
    function populateEditForm(event) {
        console.log('Admin Approvals: Populating form with event:', event);
        
        // Use standardized field names
        document.getElementById('edit-name').value = event.name || '';
        document.getElementById('edit-description').value = event.description || '';
        
        // Format date for HTML input - handle Firestore timestamps
        let formattedDate = '';
        const eventDate = event.date;
        if (eventDate) {
            try {
                let dateObj;
                if (eventDate._seconds) {
                    // Firestore timestamp
                    dateObj = new Date(eventDate._seconds * 1000);
                } else if (eventDate.toDate) {
                    // Firestore Timestamp object
                    dateObj = eventDate.toDate();
                } else {
                    // Regular date string or object
                    dateObj = new Date(eventDate);
                }
                
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toISOString().split('T')[0];
                }
            } catch (error) {
                console.error('Error formatting date:', error);
                formattedDate = '';
            }
        }
        document.getElementById('edit-date').value = formattedDate;
        
        document.getElementById('edit-time').value = event.time || '';
        document.getElementById('edit-link').value = event.link || '';
        document.getElementById('edit-status').value = event.status || 'pending';
        document.getElementById('edit-price').value = event.price || '';
        document.getElementById('edit-age-restriction').value = event.ageRestriction || '';
        
        // Handle categories (standardized array format)
        const eventCategories = event.category || [];
        const categoriesContainer = document.getElementById('edit-categories');
        categoriesContainer.innerHTML = VALID_CATEGORIES.map(category => {
            const isChecked = eventCategories.includes(category);
            return `
                <label class="flex items-center space-x-2">
                    <input type="checkbox" value="${category}" ${isChecked ? 'checked' : ''} class="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500">
                    <span class="text-sm text-gray-300">${category}</span>
                </label>
            `;
        }).join('');
        
        // Handle venue selection
        const venueSelect = document.getElementById('edit-venue-select');
        if (venueSelect) {
            venueSelect.innerHTML = '<option value="">Select a venue</option>';
            
            // Add existing venues (we'll need to load these)
            if (window.allVenues && window.allVenues.length > 0) {
                window.allVenues.forEach(venue => {
                    const option = document.createElement('option');
                    option.value = venue.id;
                    option.textContent = venue.name;
                    
                    // Match by venue ID or name
                    const currentVenueId = event.venueId;
                    const currentVenueName = event.venueName;
                    if (currentVenueId === venue.id || currentVenueName === venue.name) {
                        option.selected = true;
                    }
                    
                    venueSelect.appendChild(option);
                });
            }
            
            venueSelect.appendChild(document.createElement('option')).value = 'new';
            venueSelect.lastElementChild.textContent = '➕ Create New Venue';
        }
        
        // Handle image display and editing
        const currentImageContainer = document.getElementById('current-image-container');
        const currentImage = document.getElementById('current-image');
        const uploadImageBtn = document.getElementById('upload-image-btn');
        const editImageUpload = document.getElementById('edit-image-upload');
        const removeImageBtn = document.getElementById('remove-image-btn');
        
        if (event.image && event.image.url) {
            // Show current image
            currentImage.src = event.image.url;
            currentImageContainer.classList.remove('hidden');
            
            // Store current image data
            window.currentEventImage = event.image;
        } else {
            // Hide current image section
            currentImageContainer.classList.add('hidden');
            window.currentEventImage = null;
        }
        
        // Set up image upload button
        uploadImageBtn.onclick = () => editImageUpload.click();
        
        // Handle file selection
        editImageUpload.onchange = function(e) {
            const file = e.target.files[0];
            if (file) {
                // Show preview of new image
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentImage.src = e.target.result;
                    currentImageContainer.classList.remove('hidden');
                    window.currentEventImage = { url: e.target.result, file: file };
                };
                reader.readAsDataURL(file);
            }
        };
        
        // Handle image removal
        removeImageBtn.onclick = function() {
            currentImageContainer.classList.add('hidden');
            editImageUpload.value = '';
            window.currentEventImage = null;
        };
        
        // Store current event for editing
        window.currentEventForEdit = event;
    }
    
    function populateVenueEditForm(venue) {
        console.log('Admin Approvals: Populating venue form with:', venue);
        
        // For venues, we'll use a simpler approach since the form is primarily for events
        // You can expand this if needed for venue editing
        showNotification('Venue editing not yet implemented', 'info');
    }
    
    async function handleEditFormSubmit(event) {
        event.preventDefault();
        
        try {
            // Import auth headers
            let authModule;
            try {
                authModule = await import('/js/auth-guard.js');
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            // Check if we have a current event for editing
            if (!window.currentEventForEdit) {
                console.error('❌ SAVE: No current event for editing');
                showNotification('Error: No event selected for editing', 'error');
                return;
            }
            
            console.log(`💾 SAVE: Saving edits for event ${window.currentEventForEdit.id}`);
            
            // Convert form data to JSON for Firestore function
            const eventData = {
                itemId: window.currentEventForEdit.id,
                itemType: 'event',
                name: document.getElementById('edit-name').value,
                description: document.getElementById('edit-description').value,
                date: document.getElementById('edit-date').value,
                time: document.getElementById('edit-time').value,
                status: document.getElementById('edit-status').value,
                link: document.getElementById('edit-link').value,
                price: document.getElementById('edit-price').value,
                ageRestriction: document.getElementById('edit-age-restriction').value,
                category: Array.from(document.querySelectorAll('#edit-categories input:checked')).map(cb => cb.value)
            };
            
            // Handle venue
            const venueSelect = document.getElementById('edit-venue-select');
            if (venueSelect.value === 'new') {
                const newVenueName = document.getElementById('edit-new-venue-name').value;
                if (newVenueName) {
                    eventData.venueName = newVenueName;
                }
            } else if (venueSelect.value) {
                eventData.venueId = venueSelect.value;
            }
            
            // Handle image
            if (window.currentEventImage) {
                if (window.currentEventImage.file) {
                    // New image uploaded - we'll need to handle this in the backend
                    eventData.newImage = true;
                    eventData.imageFile = window.currentEventImage.file;
                } else {
                    // Existing image - keep the current image data
                    eventData.image = window.currentEventImage;
                }
            } else {
                // No image - clear the image
                eventData.image = null;
            }
            
            console.log(`💾 SAVE: Processed data:`, eventData);
            
            let response;
            if (eventData.newImage && eventData.imageFile) {
                // Use FormData for file upload
                const formData = new FormData();
                formData.append('image', eventData.imageFile);
                
                // Add other data as JSON string
                const { imageFile, newImage, ...otherData } = eventData;
                formData.append('data', JSON.stringify(otherData));
                
                let authOptions = {
                    method: 'POST'
                };
                if (authModule) {
                    authOptions = await authModule.getAuthHeaders(authOptions);
                }

                response = await fetch('/.netlify/functions/update-item-firestore', {
                    ...authOptions,
                    body: formData
                });
            } else {
                // Use JSON for non-file updates
                const { imageFile, newImage, ...jsonData } = eventData;

                let authOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                };
                if (authModule) {
                    authOptions = await authModule.getAuthHeaders(authOptions);
                }

                response = await fetch('/.netlify/functions/update-item-firestore', {
                    ...authOptions,
                    body: JSON.stringify(jsonData)
                });
            }
            
            if (response.ok) {
                const result = await response.json();
                showNotification('Event updated successfully!', 'success');
                
                // Store the event ID before closing modal
                const eventId = window.currentEventForEdit.id;
                
                // Update the item in our local array
                const itemIndex = allItems.findIndex(item => item.id === eventId);
                if (itemIndex !== -1) {
                    allItems[itemIndex] = { ...allItems[itemIndex], ...eventData };
                }
                
                // Close modal
                closeEditModal();
                
                // Refresh the display
                applyFiltersAndSorting();
                displayItems();
                
                console.log(`✅ SAVE: Event ${eventId} updated successfully`);
            } else {
                const errorData = await response.json();
                console.error('❌ SAVE: Server error:', errorData);
                throw new Error(`Failed to update item: ${errorData.message || 'Unknown error'}`);
            }
            
        } catch (error) {
            console.error('❌ SAVE: Error updating item:', error);
            showNotification(`Error updating item: ${error.message}`, 'error');
        }
    }
    
    function closeEditModal() {
        const modal = document.getElementById('edit-modal');
        modal.classList.add('hidden');
        window.currentEventForEdit = null;
    }
    
    async function rejectItem(id, type, reason) {
        try {
            console.log(`🔄 REJECT: Starting rejection for ${type} ${id}`);
            
            // Import auth headers
            let authOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            };
            try {
                const authModule = await import('/js/auth-guard.js');
                authOptions = await authModule.getAuthHeaders(authOptions);
            } catch (e) {
                console.warn('Auth module not available or failed:', e);
            }

            const response = await fetch('/.netlify/functions/update-item-status', {
                ...authOptions,
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
        filterPastRecurring.addEventListener('click', () => setFilter('past-recurring'));
        
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
        
        // Edit modal controls
        const closeModalBtn = document.getElementById('close-modal-btn');
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        const editForm = document.getElementById('edit-form');
        
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditModal);
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
        if (editForm) editForm.addEventListener('submit', handleEditFormSubmit);
        
        // Modal close buttons
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
        [filterAll, filterEvents, filterVenues, filterRecurring, filterPastRecurring].forEach(btn => 
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
            selectedItems.clear();
            updateBulkActions();
        }
    }
    
    async function handleRecurringApproval() {
        // Placeholder function for recurring approval modal
        // This can be implemented later if needed
        console.log('🔄 Recurring approval functionality not yet implemented');
        showNotification('Recurring approval functionality not yet implemented', 'info');
        
        // Close the modal
        document.getElementById('recurring-approval-modal').classList.add('hidden');
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
        
        const dateStr = typeof dateString === 'string' ? dateString : '';
        const hasNoTime = !dateStr.includes('T') || dateStr.includes('T00:00');
        
        const date = new Date(dateString);
        const options = {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        };
        if (!hasNoTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return date.toLocaleDateString('en-GB', options) + (hasNoTime ? ' — Time TBC' : '');
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
    
    // Image modal function
    window.openImageModal = function(imageUrl, title) {
        const modal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');
        const modalTitle = document.getElementById('modal-title');
        
        modalImage.src = imageUrl;
        modalTitle.textContent = title;
        modal.classList.remove('hidden');
        
        // Close modal when clicking outside or on close button
        modal.onclick = function(e) {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                modal.classList.add('hidden');
            }
        };
        
        // Close on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                modal.classList.add('hidden');
            }
        });
    };
});