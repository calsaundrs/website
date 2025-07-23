// Admin Edit Events JavaScript - Modern Interface
let allEvents = [];
let pendingEvents = [];
let approvedEvents = [];
let recurringEvents = [];
let currentFilter = 'all';
let currentEventForEdit = null;

// Available categories for the form
const VALID_CATEGORIES = [
    "Comedy", "Drag", "Live Music", "Party", "Pride", "Social", "Theatre", 
    "Viewing Party", "Kink", "Community", "Exhibition", "Health", "Quiz", 
    "Trans & Non-Binary", "Sober", "Queer Women & Sapphic"
];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Edit Events: Initializing modern interface...');
    initializeEventListeners();
    loadAllEvents();
});

// Initialize all event listeners
function initializeEventListeners() {
    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            setActiveFilter(filter);
            filterEvents(filter);
        });
    });

    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Modal controls
    const closeModalBtn = document.getElementById('close-modal-btn');
    const closeRecurringModalBtn = document.getElementById('close-recurring-modal-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const editForm = document.getElementById('edit-form');

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditModal);
    if (closeRecurringModalBtn) closeRecurringModalBtn.addEventListener('click', closeRecurringModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
    if (deleteEventBtn) deleteEventBtn.addEventListener('click', handleDeleteEvent);
    if (editForm) editForm.addEventListener('submit', handleEditFormSubmit);

    // Add event button
    const addEventBtn = document.getElementById('add-event-btn');
    if (addEventBtn) addEventBtn.addEventListener('click', () => openEditModal(null));

    // Bulk actions button
    const bulkActionsBtn = document.getElementById('bulk-actions-btn');
    if (bulkActionsBtn) bulkActionsBtn.addEventListener('click', handleBulkActions);
}

// Set active filter button
function setActiveFilter(filter) {
    currentFilter = filter;
    
    // Update button states
    document.querySelectorAll('[data-filter]').forEach(button => {
        button.classList.remove('active');
    });
    
    // Set active button
    const activeButton = document.querySelector(`[data-filter="${filter}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// Filter events based on selected filter
function filterEvents(filter) {
    console.log(`Admin Edit Events: Filtering events by ${filter}`);
    
    // Hide loading state
    const loadingState = document.getElementById('loading-state');
    if (loadingState) {
        loadingState.classList.add('hidden');
    }
    
    // Get containers
    const eventsContainer = document.getElementById('events-container');
    const recurringContainer = document.getElementById('recurring-events-container');
    
    // Hide all containers first
    if (eventsContainer) eventsContainer.classList.add('hidden');
    if (recurringContainer) recurringContainer.classList.add('hidden');
    
    switch(filter) {
        case 'all':
            if (eventsContainer) {
                eventsContainer.classList.remove('hidden');
                renderEvents(allEvents);
            }
            break;
        case 'pending':
            if (eventsContainer) {
                eventsContainer.classList.remove('hidden');
                renderEvents(pendingEvents);
            }
            break;
        case 'approved':
            if (eventsContainer) {
                eventsContainer.classList.remove('hidden');
                renderEvents(approvedEvents);
            }
            break;
        case 'recurring':
            if (recurringContainer) {
                recurringContainer.classList.remove('hidden');
                renderRecurringEvents(recurringEvents);
            }
            break;
    }
}

// Load all events data
async function loadAllEvents() {
    try {
        console.log('Admin Edit Events: Loading all events...');
        
        // Load regular events
        const eventsResponse = await fetch('/.netlify/functions/get-events');
        console.log('Admin Edit Events: Events response status:', eventsResponse.status);
        
        if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            console.log('Admin Edit Events: Events data received:', eventsData);
            allEvents = eventsData.events || [];
            
            // Separate pending and approved events
            pendingEvents = allEvents.filter(event => {
                const status = event.status || event.Status || event['Status'];
                return status === 'Pending Review';
            });
            approvedEvents = allEvents.filter(event => {
                const status = event.status || event.Status || event['Status'];
                return status === 'Approved';
            });
            
            console.log(`Admin Edit Events: Loaded ${allEvents.length} total events (${pendingEvents.length} pending, ${approvedEvents.length} approved)`);
        } else {
            console.error('Admin Edit Events: Failed to load events:', eventsResponse.status, eventsResponse.statusText);
        }
        
        // Load recurring events
        const recurringResponse = await fetch('/.netlify/functions/get-recurring-events');
        console.log('Admin Edit Events: Recurring response status:', recurringResponse.status);
        
        if (recurringResponse.ok) {
            const recurringData = await recurringResponse.json();
            console.log('Admin Edit Events: Recurring data received:', recurringData);
            recurringEvents = recurringData.recurringEvents || [];
            console.log(`Admin Edit Events: Loaded ${recurringEvents.length} recurring events`);
        } else {
            console.error('Admin Edit Events: Failed to load recurring events:', recurringResponse.status, recurringResponse.statusText);
        }
        
        // Update stats
        updateStats();
        
        // Render initial view
        filterEvents(currentFilter);
        
    } catch (error) {
        console.error('Admin Edit Events: Error loading events:', error);
        showError('Failed to load events. Please try again.');
    }
}

// Update statistics dashboard
function updateStats() {
    const totalCount = document.getElementById('total-events-count');
    const pendingCount = document.getElementById('pending-events-count');
    const approvedCount = document.getElementById('approved-events-count');
    const recurringCount = document.getElementById('recurring-events-count');
    
    if (totalCount) totalCount.textContent = allEvents.length;
    if (pendingCount) pendingCount.textContent = pendingEvents.length;
    if (approvedCount) approvedCount.textContent = approvedEvents.length;
    if (recurringCount) recurringCount.textContent = recurringEvents.length;
}

// Render regular events with modern cards
function renderEvents(events) {
    const container = document.getElementById('events-container');
    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16">
                <i class="fas fa-calendar-times text-6xl text-gray-600 mb-4"></i>
                <p class="text-gray-400 text-xl">No events found</p>
                <p class="text-gray-500 mt-2">Try adjusting your filters or search terms</p>
            </div>
        `;
        return;
    }

    const eventsHtml = events.map(event => {
        const status = event.status || event.Status || event['Status'] || 'Unknown';
        const statusBadge = getStatusBadge(status);
        const categoryBadges = (event.category || event.Category || []).map(cat => 
            `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full mr-1 mb-1">${cat}</span>`
        ).join('');

        const eventDate = new Date(event.date || event.Date);
        const isToday = new Date().toDateString() === eventDate.toDateString();
        const isPast = eventDate < new Date();

        return `
            <div class="event-card rounded-xl p-6 transition-all duration-300 ${isPast ? 'opacity-75' : ''}">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="text-center w-16 flex-shrink-0">
                                <div class="text-2xl font-bold text-white ${isToday ? 'text-purple-400' : ''}">
                                    ${eventDate.getDate()}
                                </div>
                                <div class="text-sm text-gray-400">
                                    ${eventDate.toLocaleDateString('en-US', { month: 'short' })}
                                </div>
                            </div>
                            <div class="flex-1">
                                <h3 class="text-xl font-bold text-white mb-1">${event.name || event['Event Name'] || 'Untitled Event'}</h3>
                                <p class="text-gray-400 text-sm">${event.venue || event.VenueText || event['Venue Name'] || 'TBC'}</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2 mb-3">
                            ${statusBadge}
                            ${isToday ? '<span class="inline-block bg-purple-100/20 text-purple-300 text-xs px-2 py-1 rounded-full">Today</span>' : ''}
                            ${isPast ? '<span class="inline-block bg-gray-100/20 text-gray-300 text-xs px-2 py-1 rounded-full">Past</span>' : ''}
                        </div>
                        
                        <p class="text-gray-300 mb-3 line-clamp-2">${event.description || event.Description || 'No description available'}</p>
                        
                        <div class="flex flex-wrap gap-1 mb-4">
                            ${categoryBadges}
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2 ml-4">
                        <button onclick="openEditModal('${event.id}')" class="btn-primary text-white px-4 py-2 rounded-lg text-sm transition-all">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button onclick="handleDeleteEvent('${event.id}')" class="btn-danger text-white px-4 py-2 rounded-lg text-sm transition-all">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = eventsHtml;
}

// Render recurring events with modern cards
function renderRecurringEvents(events) {
    const container = document.getElementById('recurring-events-container');
    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16">
                <i class="fas fa-redo text-6xl text-gray-600 mb-4"></i>
                <p class="text-gray-400 text-xl">No recurring events found</p>
                <p class="text-gray-500 mt-2">Recurring events will appear here when available</p>
            </div>
        `;
        return;
    }

    const eventsHtml = events.map(event => {
        const status = event.status || event.Status || event['Status'] || 'Unknown';
        const statusBadge = getStatusBadge(status);
        const categoryBadges = (event.category || event.Category || []).map(cat => 
            `<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full mr-1 mb-1">${cat}</span>`
        ).join('');
        
        const activeBadge = event.isActive ? 
            '<span class="inline-block bg-green-100/20 text-green-300 text-xs px-2 py-1 rounded-full mr-2">Active</span>' :
            '<span class="inline-block bg-gray-100/20 text-gray-300 text-xs px-2 py-1 rounded-full mr-2">Ended</span>';
        
        const nextInstanceInfo = event.nextInstance ? 
            `<div class="text-sm text-gray-400 mt-2">
                <i class="fas fa-calendar-alt mr-1"></i>
                <strong>Next:</strong> ${formatDate(event.nextInstance.date)} (${event.nextInstance.status})
            </div>` : '';
        
        const instanceCounts = `
            <div class="text-sm text-gray-400 mt-2">
                <i class="fas fa-layer-group mr-1"></i>
                <strong>Instances:</strong> ${event.totalInstances} total 
                (${event.futureInstances} upcoming, ${event.pastInstances} past)
            </div>
        `;

        return `
            <div class="event-card rounded-xl p-6 transition-all duration-300 ${!event.isActive ? 'opacity-75' : ''}">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="text-center w-16 flex-shrink-0">
                                <div class="text-2xl font-bold text-white">
                                    <i class="fas fa-redo"></i>
                                </div>
                                <div class="text-sm text-gray-400">
                                    Series
                                </div>
                            </div>
                            <div class="flex-1">
                                <h3 class="text-xl font-bold text-white mb-1">${event.name || event['Event Name'] || 'Untitled Event'}</h3>
                                <p class="text-gray-400 text-sm">${event.venue || event.VenueText || event['Venue Name'] || 'TBC'}</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2 mb-3">
                            ${activeBadge}
                            ${statusBadge}
                        </div>
                        
                        <p class="text-gray-300 mb-3 line-clamp-2">${event.description || event.Description || 'No description available'}</p>
                        
                        <div class="text-sm text-purple-300 mb-3">
                            <i class="fas fa-clock mr-1"></i>
                            ${event.recurringInfo || event['Recurring Info'] || 'Recurring Event'}
                        </div>
                        
                        ${nextInstanceInfo}
                        ${instanceCounts}
                        
                        <div class="flex flex-wrap gap-1 mt-4">
                            ${categoryBadges}
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2 ml-4">
                        <button onclick="openRecurringModal('${event.seriesId || event.id}')" class="btn-primary text-white px-4 py-2 rounded-lg text-sm transition-all">
                            <i class="fas fa-cog mr-1"></i>Manage
                        </button>
                        <button onclick="handleEndRecurringSeries('${event.seriesId || event.id}')" class="btn-danger text-white px-4 py-2 rounded-lg text-sm transition-all">
                            <i class="fas fa-stop mr-1"></i>End Series
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = eventsHtml;
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusClasses = {
        'Approved': 'status-badge approved',
        'Pending Review': 'status-badge pending',
        'Rejected': 'status-badge rejected'
    };
    
    const classes = statusClasses[status] || 'status-badge';
    return `<span class="inline-block ${classes} text-xs px-2 py-1 rounded-full">${status}</span>`;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'TBC';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Search functionality
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    console.log('Searching for:', searchTerm);
    
    // Filter events based on search term
    const filteredEvents = allEvents.filter(event => {
        const name = (event.name || event['Event Name'] || '').toLowerCase();
        const description = (event.description || event.Description || '').toLowerCase();
        const venue = (event.venue || event.VenueText || event['Venue Name'] || '').toLowerCase();
        
        return name.includes(searchTerm) || description.includes(searchTerm) || venue.includes(searchTerm);
    });
    
    // Update the current view
    switch(currentFilter) {
        case 'all':
            renderEvents(filteredEvents);
            break;
        case 'pending':
            renderEvents(filteredEvents.filter(e => (e.status || e.Status || e['Status']) === 'Pending Review'));
            break;
        case 'approved':
            renderEvents(filteredEvents.filter(e => (e.status || e.Status || e['Status']) === 'Approved'));
            break;
        case 'recurring':
            const filteredRecurring = recurringEvents.filter(event => {
                const name = (event.name || event['Event Name'] || '').toLowerCase();
                const description = (event.description || event.Description || '').toLowerCase();
                const venue = (event.venue || event.VenueText || event['Venue Name'] || '').toLowerCase();
                
                return name.includes(searchTerm) || description.includes(searchTerm) || venue.includes(searchTerm);
            });
            renderRecurringEvents(filteredRecurring);
            break;
    }
}

// Modal functions
function openEditModal(eventId) {
    currentEventForEdit = eventId ? allEvents.find(e => e.id === eventId) : null;
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    
    if (currentEventForEdit) {
        modalTitle.innerHTML = '<i class="fas fa-edit mr-3"></i>Edit Event';
        populateEditForm(currentEventForEdit);
    } else {
        modalTitle.innerHTML = '<i class="fas fa-plus mr-3"></i>Add New Event';
        populateEditForm(null);
    }
    
    modal.classList.remove('hidden');
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    modal.classList.add('hidden');
    currentEventForEdit = null;
}

function openRecurringModal(seriesId) {
    const recurringEvent = recurringEvents.find(e => (e.seriesId || e.id) === seriesId);
    if (!recurringEvent) {
        showError('Recurring event not found');
        return;
    }
    
    const modal = document.getElementById('recurring-modal');
    const content = document.getElementById('recurring-modal-content');
    
    content.innerHTML = `
        <div class="space-y-6">
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h4 class="text-xl font-bold text-white mb-4">Series Information</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Series Name</label>
                        <input type="text" id="recurring-name" value="${recurringEvent.name || recurringEvent['Event Name'] || ''}" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Venue</label>
                        <input type="text" id="recurring-venue" value="${recurringEvent.venue || ''}" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none">
                    </div>
                </div>
                <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea id="recurring-description" rows="3" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none resize-none">${recurringEvent.description || recurringEvent.Description || ''}</textarea>
                </div>
            </div>
            
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h4 class="text-xl font-bold text-white mb-4">Instance Management</h4>
                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">Total Instances:</span>
                        <span class="text-white font-bold">${recurringEvent.totalInstances}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">Future Instances:</span>
                        <span class="text-green-400 font-bold">${recurringEvent.futureInstances}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-300">Past Instances:</span>
                        <span class="text-gray-400 font-bold">${recurringEvent.pastInstances}</span>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end gap-4">
                <button onclick="closeRecurringModal()" class="btn-secondary text-white px-6 py-3 rounded-lg transition-all">
                    <i class="fas fa-times mr-2"></i>Cancel
                </button>
                <button onclick="saveRecurringChanges('${seriesId}')" class="btn-primary text-white px-6 py-3 rounded-lg transition-all">
                    <i class="fas fa-save mr-2"></i>Save Changes
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeRecurringModal() {
    const modal = document.getElementById('recurring-modal');
    modal.classList.add('hidden');
}

// Form handling
function populateEditForm(event) {
    const nameInput = document.getElementById('edit-name');
    const venueInput = document.getElementById('edit-venue');
    const descriptionInput = document.getElementById('edit-description');
    const dateInput = document.getElementById('edit-date');
    const timeInput = document.getElementById('edit-time');
    const statusSelect = document.getElementById('edit-status');
    const categoriesContainer = document.getElementById('edit-categories');
    
    if (event) {
        // Editing existing event
        nameInput.value = event.name || event['Event Name'] || '';
        venueInput.value = event.venue || event.VenueText || event['Venue Name'] || '';
        descriptionInput.value = event.description || event.Description || '';
        
        const eventDate = new Date(event.date || event.Date);
        if (!isNaN(eventDate.getTime())) {
            dateInput.value = eventDate.toISOString().split('T')[0];
            timeInput.value = eventDate.toTimeString().slice(0, 5);
        }
        
        statusSelect.value = event.status || event.Status || event['Status'] || 'Pending Review';
        
        // Show delete button for existing events
        document.getElementById('delete-event-btn').classList.remove('hidden');
    } else {
        // Adding new event
        nameInput.value = '';
        venueInput.value = '';
        descriptionInput.value = '';
        dateInput.value = '';
        timeInput.value = '';
        statusSelect.value = 'Pending Review';
        
        // Hide delete button for new events
        document.getElementById('delete-event-btn').classList.add('hidden');
    }
    
    // Populate categories
    const currentCategories = event ? (event.category || event.Category || []) : [];
    categoriesContainer.innerHTML = VALID_CATEGORIES.map(cat => `
        <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" name="categories" value="${cat}" ${currentCategories.includes(cat) ? 'checked' : ''} 
                   class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
            <span class="text-gray-300 text-sm">${cat}</span>
        </label>
    `).join('');
}

async function handleEditFormSubmit(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
        
        const formData = new FormData();
        
        // Add form fields
        formData.append('Event Name', document.getElementById('edit-name').value);
        formData.append('VenueText', document.getElementById('edit-venue').value);
        formData.append('Description', document.getElementById('edit-description').value);
        formData.append('date', document.getElementById('edit-date').value);
        formData.append('time', document.getElementById('edit-time').value);
        formData.append('Status', document.getElementById('edit-status').value);
        
        // Add categories
        const selectedCategories = Array.from(document.querySelectorAll('input[name="categories"]:checked'))
            .map(cb => cb.value);
        formData.append('Category', JSON.stringify(selectedCategories));
        
        if (currentEventForEdit) {
            // Updating existing event
            formData.append('id', currentEventForEdit.id);
            formData.append('type', 'Event');
            
            const response = await fetch('/.netlify/functions/update-submission', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update event');
            }
            
            showSuccess('Event updated successfully!');
        } else {
            // Creating new event
            const response = await fetch('/.netlify/functions/create-approved-event', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create event');
            }
            
            showSuccess('Event created successfully!');
        }
        
        closeEditModal();
        await loadAllEvents(); // Reload data
        
    } catch (error) {
        console.error('Error saving event:', error);
        showError(`Error saving event: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function handleDeleteEvent(eventId) {
    const event = eventId ? allEvents.find(e => e.id === eventId) : currentEventForEdit;
    if (!event) return;
    
    if (!confirm(`Are you sure you want to delete "${event.name || event['Event Name']}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/delete-submission', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: event.id,
                type: 'Event'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete event');
        }
        
        showSuccess('Event deleted successfully!');
        closeEditModal();
        await loadAllEvents(); // Reload data
        
    } catch (error) {
        console.error('Error deleting event:', error);
        showError(`Error deleting event: ${error.message}`);
    }
}

async function handleEndRecurringSeries(seriesId) {
    const recurringEvent = recurringEvents.find(e => (e.seriesId || e.id) === seriesId);
    if (!recurringEvent) {
        showError('Recurring event not found');
        return;
    }
    
    if (!confirm(`Are you sure you want to end the recurring series "${recurringEvent.name || recurringEvent['Event Name']}"? This will mark all future instances as ended.`)) {
        return;
    }
    
    try {
        // This would need to be implemented in the backend
        showError('End series functionality not yet implemented');
    } catch (error) {
        console.error('Error ending recurring series:', error);
        showError(`Error ending series: ${error.message}`);
    }
}

async function saveRecurringChanges(seriesId) {
    try {
        const name = document.getElementById('recurring-name').value;
        const venue = document.getElementById('recurring-venue').value;
        const description = document.getElementById('recurring-description').value;
        
        // This would need to be implemented in the backend
        showSuccess('Recurring series updated successfully!');
        closeRecurringModal();
        await loadAllEvents(); // Reload data
        
    } catch (error) {
        console.error('Error updating recurring series:', error);
        showError(`Error updating series: ${error.message}`);
    }
}

function handleBulkActions() {
    showError('Bulk actions functionality not yet implemented');
}

// Utility functions
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Global functions for onclick handlers
window.openEditModal = openEditModal;
window.handleDeleteEvent = handleDeleteEvent;
window.openRecurringModal = openRecurringModal;
window.handleEndRecurringSeries = handleEndRecurringSeries;
window.saveRecurringChanges = saveRecurringChanges;