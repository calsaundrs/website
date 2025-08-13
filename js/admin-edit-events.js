// Admin Edit Events JavaScript - Modern Interface
let allEvents = [];
let pendingEvents = [];
let approvedEvents = [];
let recurringEvents = [];
let currentFilter = 'all';
let currentEventForEdit = null;
let selectedEvents = new Set(); // For bulk actions
let allVenues = []; // For venue picker

// Available categories for the form (matching promoter submission)
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
    loadVenues();
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
        case 'recurring':
            if (recurringContainer) {
                recurringContainer.classList.remove('hidden');
                renderRecurringEvents(recurringEvents);
            }
            break;
        case 'past':
            if (eventsContainer) {
                eventsContainer.classList.remove('hidden');
                renderEvents(window.pastEvents || []);
            }
            break;
    }
}

// Load venues for the venue picker
async function loadVenues() {
    try {
        console.log('Admin Edit Events: Loading venues...');
        const response = await fetch('/.netlify/functions/get-admin-venues');
        
        if (response.ok) {
            allVenues = await response.json();
            console.log(`Admin Edit Events: Loaded ${allVenues.length} venues`);
        } else {
            console.error('Admin Edit Events: Venue list response not ok:', response.status, response.statusText);
            allVenues = []; // Set empty array to prevent errors
        }
    } catch (error) {
        console.error('Admin Edit Events: Error loading venues:', error);
        allVenues = []; // Set empty array to prevent errors
        // Don't show error to user as this is not critical for basic functionality
    }
}

// Load all events data
async function loadAllEvents() {
    try {
        console.log('Admin Edit Events: Loading all events...');
        
        // Load all events (both future and past) for manage events view
        const response = await fetch('/.netlify/functions/get-admin-events?status=approved');
        console.log('Admin Edit Events: Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Admin Edit Events: Data received:', data);
            
            if (data.success) {
                // Future events for main display
                allEvents = data.events || [];
                approvedEvents = data.events || []; // All events are approved in this view
                recurringEvents = data.recurringEvents || [];
                
                // Past events for separate view
                const pastEvents = data.allEvents ? data.allEvents.filter(e => !e.isFutureEvent) : [];
                
                console.log(`Admin Edit Events: Loaded ${allEvents.length} future events`);
                console.log(`Admin Edit Events: Loaded ${pastEvents.length} past events`);
                console.log(`  - Future: ${allEvents.length}`);
                console.log(`  - Past: ${pastEvents.length}`);
                console.log(`  - Recurring: ${recurringEvents.length}`);
                
                // Store past events globally for the past filter
                window.pastEvents = pastEvents;
            } else {
                console.error('Admin Edit Events: Failed to load events:', data.error);
                allEvents = [];
                approvedEvents = [];
                recurringEvents = [];
                window.pastEvents = [];
            }
        } else {
            console.error('Admin Edit Events: Failed to load events:', response.status, response.statusText);
            allEvents = [];
            approvedEvents = [];
            recurringEvents = [];
            window.pastEvents = [];
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
    const approvedCount = document.getElementById('approved-events-count');
    const recurringCount = document.getElementById('recurring-events-count');
    
    if (totalCount) totalCount.textContent = allEvents.length;
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
        const isSelected = selectedEvents.has(event.id);

        // Handle recurring event display
        let recurringDisplay = '';
        if (event.isRecurring || event.isRecurringGroup || event.recurringInfo || event.recurringPattern) {
            if (event.recurringPattern) {
                switch (event.recurringPattern.toLowerCase()) {
                    case 'weekly':
                        recurringDisplay = 'Every Monday';
                        break;
                    case 'bi-weekly':
                        recurringDisplay = 'Every 2 Weeks';
                        break;
                    case 'monthly':
                        recurringDisplay = 'Every Month';
                        break;
                    case 'daily':
                        recurringDisplay = 'Every Day';
                        break;
                    case 'yearly':
                        recurringDisplay = 'Every Year';
                        break;
                    default:
                        recurringDisplay = 'Recurring Event';
                }
            } else if (event.recurringInfo) {
                const recurringText = event.recurringInfo.toLowerCase();
                if (recurringText.includes('weekly') || recurringText.includes('every week')) {
                    recurringDisplay = 'Every Monday';
                } else if (recurringText.includes('monthly') || recurringText.includes('every month')) {
                    recurringDisplay = 'Every Month';
                } else if (recurringText.includes('daily') || recurringText.includes('every day')) {
                    recurringDisplay = 'Every Day';
                } else if (recurringText.includes('bi-weekly') || recurringText.includes('every two weeks')) {
                    recurringDisplay = 'Every 2 Weeks';
                } else if (recurringText.includes('yearly') || recurringText.includes('annual')) {
                    recurringDisplay = 'Every Year';
                } else {
                    recurringDisplay = 'Recurring Event';
                }
            } else if (event.isRecurring) {
                recurringDisplay = 'Recurring Event';
            }
        }

        // Handle event image
        const eventImage = event.image || event.Image || event['Promo Image'] || event['promo-image'];
        const imageUrl = eventImage ? (typeof eventImage === 'string' ? eventImage : (eventImage.url || eventImage[0]?.url)) : null;
        const imageHtml = imageUrl ? 
            `<img src="${imageUrl}" alt="Event image" class="w-full h-48 object-cover rounded-lg mb-4" onerror="this.style.display='none'">` :
            `<div class="w-full h-48 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg mb-4 flex items-center justify-center">
                <i class="fas fa-image text-4xl text-gray-600"></i>
            </div>`;

        return `
            <div class="event-card ${isPast ? 'opacity-75' : ''} ${isSelected ? 'ring-2 ring-purple-500' : ''}">
                <div class="event-card-header">
                    <div class="flex items-start space-x-3 flex-1 min-w-0">
                        <div class="text-2xl text-blue-400 flex-shrink-0 mt-1">
                            <i class="fas fa-calendar"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <h3 class="text-xl font-bold text-white truncate">${event.name || event['Event Name'] || 'Untitled Event'}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                ${statusBadge}
                                ${isToday ? '<span class="inline-block bg-purple-100/20 text-purple-300 text-xs px-2 py-1 rounded-full">Today</span>' : ''}
                                ${isPast ? '<span class="inline-block bg-gray-100/20 text-gray-300 text-xs px-2 py-1 rounded-full">Past</span>' : ''}
                                ${recurringDisplay ? `<span class="inline-block bg-green-100/20 text-green-300 text-xs px-2 py-1 rounded-full"><i class="fas fa-redo mr-1"></i>${recurringDisplay}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-sm text-gray-400 flex-shrink-0">
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" 
                                   class="bulk-select-checkbox form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500" 
                                   data-event-id="${event.id}"
                                   ${isSelected ? 'checked' : ''}>
                            <span class="ml-2 text-gray-400 text-xs">Select</span>
                        </label>
                    </div>
                </div>
                
                <div class="event-card-details">
                    <div class="event-card-detail-item">
                        <p class="detail-label">Description</p>
                        <p class="detail-value">${event.description || event.Description || 'No description available'}</p>
                    </div>
                    
                    <div class="event-card-detail-item">
                        <p class="detail-label">Event Date</p>
                        <p class="detail-value">${eventDate.toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</p>
                    </div>
                    
                    <div class="event-card-detail-item">
                        <p class="detail-label">Venue</p>
                        <p class="detail-value">${event.venue || event.VenueText || event['Venue Name'] || event.venueName || 'TBC'}</p>
                    </div>
                    
                    ${event.category && event.category.length > 0 ? `
                        <div class="event-card-detail-item">
                            <p class="detail-label">Categories</p>
                            <div class="flex flex-wrap gap-1">
                                ${categoryBadges}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="event-card-detail-item">
                        <p class="detail-label">Submitted By</p>
                        <p class="detail-value">${event.submittedBy || event['Submitted By'] || 'Unknown'}</p>
                    </div>
                    
                    ${(event.isRecurring || event.isRecurringGroup) ? `
                        <div class="event-card-detail-item">
                            <p class="detail-label">Recurring Event</p>
                            <p class="detail-value">
                                ${recurringDisplay}
                                ${event.totalInstances ? ` (${event.totalInstances} instances)` : ''}
                                ${event.recurringInstance ? ` (Instance ${event.recurringInstance})` : ''}
                            </p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="event-card-actions">
                    <button onclick="openEditModal('${event.id}')" class="button-edit">
                        <i class="fas fa-edit mr-2"></i>Edit
                    </button>
                    ${!(event.isRecurring || event.isRecurringGroup || event.recurringGroupId) ? `
                        <button onclick="openConvertToRecurringModal('${event.id}')" class="button-convert">
                            <i class="fas fa-redo mr-2"></i>Make Recurring
                        </button>
                    ` : ''}
                    <button onclick="handleDeleteEvent('${event.id}')" class="button-delete">
                        <i class="fas fa-trash mr-2"></i>Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = eventsHtml;
    
    // Add event listeners for bulk selection checkboxes
    container.querySelectorAll('.bulk-select-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const eventId = this.getAttribute('data-event-id');
            if (this.checked) {
                selectedEvents.add(eventId);
            } else {
                selectedEvents.delete(eventId);
            }
            updateBulkActionsVisibility();
        });
    });
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

        // Handle event image
        const eventImage = event.image || event.Image || event['Promo Image'] || event['promo-image'];
        const imageUrl = eventImage ? (Array.isArray(eventImage) ? eventImage[0].url : eventImage) : null;
        const imageHtml = imageUrl ? 
            `<img src="${imageUrl}" alt="Event image" class="w-full h-48 object-cover rounded-lg mb-4" onerror="this.style.display='none'">` :
            `<div class="w-full h-48 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg mb-4 flex items-center justify-center">
                <i class="fas fa-image text-4xl text-gray-600"></i>
            </div>`;

        return `
            <div class="event-card rounded-xl p-6 transition-all duration-300 ${!event.isActive ? 'opacity-75' : ''}">
                <!-- Event Image - Moved to top for better visibility -->
                ${imageHtml}
                
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
    
    // Parse recurring info for form population
    let recurringInfo = {};
    try {
        if (recurringEvent.recurringInfo || recurringEvent['Recurring Info']) {
            recurringInfo = JSON.parse(recurringEvent.recurringInfo || recurringEvent['Recurring Info']);
        }
    } catch (e) {
        console.log('Could not parse recurring info, using default');
    }
    
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Series Information -->
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h4 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-info-circle mr-2"></i>Series Information
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Series Name</label>
                        <input type="text" id="recurring-name" value="${recurringEvent.name || recurringEvent['Event Name'] || ''}" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Venue</label>
                        <select id="recurring-venue" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none">
                            <option value="">Select an existing venue...</option>
                            ${allVenues && allVenues.length > 0 ? allVenues.map(venue => {
                                // Check if this venue matches the current event's venue
                                const currentVenueId = recurringEvent.venueId || recurringEvent.Venue;
                                const currentVenueName = recurringEvent.venue || recurringEvent.VenueText || recurringEvent['Venue Name'];
                                const isSelected = currentVenueId === venue.id || currentVenueName === venue.name;
                                return `<option value="${venue.id}" ${isSelected ? 'selected' : ''}>${venue.name}</option>`;
                            }).join('') : ''}
                            <option value="new">➕ Create New Venue</option>
                        </select>
                        <p class="text-xs text-gray-400 mt-1">Select an existing venue or choose "Create New Venue" below</p>
                    </div>
                </div>
                
                <!-- New Venue Fields (hidden by default) -->
                <div id="new-venue-fields" class="hidden mt-4 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
                    <h5 class="text-blue-300 font-semibold mb-3">
                        <i class="fas fa-plus-circle mr-2"></i>Create New Venue
                    </h5>
                    <p class="text-sm text-blue-200 mb-4">Fill in the details for your new venue below.</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Venue Name</label>
                            <input type="text" id="new-venue-name" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none" placeholder="Enter venue name">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Venue Address</label>
                            <input type="text" id="new-venue-address" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none" placeholder="Enter venue address">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Postcode</label>
                            <input type="text" id="new-venue-postcode" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none" placeholder="Enter postcode">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-2">Website (Optional)</label>
                            <input type="url" id="new-venue-website" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none" placeholder="https://">
                        </div>
                    </div>
                </div>
                
                <div class="mt-4">
                    <label class="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea id="recurring-description" rows="3" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none resize-none">${recurringEvent.description || recurringEvent.Description || ''}</textarea>
                </div>
            </div>
            
            <!-- Image Upload -->
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h4 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-image mr-2"></i>Event Image
                </h4>
                <div class="space-y-4">
                    <div class="flex items-center space-x-4">
                        <div class="w-24 h-24 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                            <img id="current-image" src="${recurringEvent.image || recurringEvent.Image || recurringEvent['Promo Image'] ? (Array.isArray(recurringEvent.image || recurringEvent.Image || recurringEvent['Promo Image']) ? (recurringEvent.image || recurringEvent.Image || recurringEvent['Promo Image'])[0].url : (recurringEvent.image || recurringEvent.Image || recurringEvent['Promo Image'])) : ''}" 
                                 alt="Current image" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <i class="fas fa-image text-2xl text-gray-500" style="display: ${recurringEvent.image || recurringEvent.Image || recurringEvent['Promo Image'] ? 'none' : 'flex'};"></i>
                        </div>
                        <div class="flex-1">
                            <input type="file" id="recurring-image" accept="image/*" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none" disabled>
                            <p class="text-sm text-gray-400 mt-1">Image upload functionality coming soon</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recurrence Rules -->
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h4 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-redo mr-2"></i>Recurrence Rules
                </h4>
                <div class="space-y-4">
                    <div class="flex items-center space-x-6">
                        <label class="flex items-center">
                            <input type="radio" name="recurrence-type" value="none" ${(!recurringInfo.type || recurringInfo.type === 'none') ? 'checked' : ''} class="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500">
                            <span class="ml-2 text-gray-300">No Recurrence</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="recurrence-type" value="weekly" ${recurringInfo.type === 'weekly' ? 'checked' : ''} class="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500">
                            <span class="ml-2 text-gray-300">Weekly</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="recurrence-type" value="monthly" ${recurringInfo.type === 'monthly' ? 'checked' : ''} class="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500">
                            <span class="ml-2 text-gray-300">Monthly</span>
                        </label>
                    </div>
                    
                    <!-- Weekly Options -->
                    <div id="weekly-options" class="hidden space-y-3">
                        <label class="block text-sm font-semibold text-gray-300">Repeat on:</label>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <label class="flex items-center">
                                <input type="checkbox" name="weekly-days" value="1" ${(recurringInfo.days || []).includes(1) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <span class="ml-2 text-gray-300 text-sm">Monday</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" name="weekly-days" value="2" ${(recurringInfo.days || []).includes(2) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <span class="ml-2 text-gray-300 text-sm">Tuesday</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" name="weekly-days" value="3" ${(recurringInfo.days || []).includes(3) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <span class="ml-2 text-gray-300 text-sm">Wednesday</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" name="weekly-days" value="4" ${(recurringInfo.days || []).includes(4) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <span class="ml-2 text-gray-300 text-sm">Thursday</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" name="weekly-days" value="5" ${(recurringInfo.days || []).includes(5) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <span class="ml-2 text-gray-300 text-sm">Friday</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" name="weekly-days" value="6" ${(recurringInfo.days || []).includes(6) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <span class="ml-2 text-gray-300 text-sm">Saturday</span>
                            </label>
                            <label class="flex items-center">
                                <input type="checkbox" name="weekly-days" value="0" ${(recurringInfo.days || []).includes(0) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                                <span class="ml-2 text-gray-300 text-sm">Sunday</span>
                            </label>
                        </div>
                    </div>
                    
                    <!-- Monthly Options -->
                    <div id="monthly-options" class="hidden space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-gray-300 mb-2">Monthly Recurrence Type:</label>
                            <div class="flex items-center space-x-4">
                                <label class="flex items-center">
                                    <input type="radio" name="monthly-type" value="date" ${(!recurringInfo.monthlyType || recurringInfo.monthlyType === 'date') ? 'checked' : ''} class="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500">
                                    <span class="ml-2 text-gray-300">By Date (e.g., 15th of every month)</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="radio" name="monthly-type" value="day" ${recurringInfo.monthlyType === 'day' ? 'checked' : ''} class="form-radio h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500">
                                    <span class="ml-2 text-gray-300">By Day (e.g., 2nd Friday of every month)</span>
                                </label>
                            </div>
                        </div>
                        
                        <div id="monthly-by-date-options">
                            <label class="block text-sm font-semibold text-gray-300 mb-2">Day of Month:</label>
                            <input type="number" id="monthly-day-of-month" name="monthly-day-of-month" min="1" max="31" value="${recurringInfo.dayOfMonth || ''}" class="form-input w-32 px-4 py-3 rounded-lg text-white focus:outline-none">
                        </div>
                        
                        <div id="monthly-by-day-options" class="hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-300 mb-2">Week of Month:</label>
                                <select id="monthly-week" name="monthly-week" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none">
                                    <option value="1" ${recurringInfo.week === 1 ? 'selected' : ''}>First</option>
                                    <option value="2" ${recurringInfo.week === 2 ? 'selected' : ''}>Second</option>
                                    <option value="3" ${recurringInfo.week === 3 ? 'selected' : ''}>Third</option>
                                    <option value="4" ${recurringInfo.week === 4 ? 'selected' : ''}>Fourth</option>
                                    <option value="-1" ${recurringInfo.week === -1 ? 'selected' : ''}>Last</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-300 mb-2">Day of Week:</label>
                                <select id="monthly-day-of-week" name="monthly-day-of-week" class="form-input w-full px-4 py-3 rounded-lg text-white focus:outline-none">
                                    <option value="0" ${recurringInfo.dayOfWeek === 0 ? 'selected' : ''}>Sunday</option>
                                    <option value="1" ${recurringInfo.dayOfWeek === 1 ? 'selected' : ''}>Monday</option>
                                    <option value="2" ${recurringInfo.dayOfWeek === 2 ? 'selected' : ''}>Tuesday</option>
                                    <option value="3" ${recurringInfo.dayOfWeek === 3 ? 'selected' : ''}>Wednesday</option>
                                    <option value="4" ${recurringInfo.dayOfWeek === 4 ? 'selected' : ''}>Thursday</option>
                                    <option value="5" ${recurringInfo.dayOfWeek === 5 ? 'selected' : ''}>Friday</option>
                                    <option value="6" ${recurringInfo.dayOfWeek === 6 ? 'selected' : ''}>Saturday</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Instance Management -->
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h4 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-layer-group mr-2"></i>Instance Management
                </h4>
                <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                            <span class="text-gray-300">Total Instances:</span>
                            <span class="text-white font-bold">${recurringEvent.totalInstances}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                            <span class="text-gray-300">Future Instances:</span>
                            <span class="text-green-400 font-bold">${recurringEvent.futureInstances}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                            <span class="text-gray-300">Past Instances:</span>
                            <span class="text-gray-400 font-bold">${recurringEvent.pastInstances}</span>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Instances to Show in Advance</label>
                        <input type="number" id="instances-ahead" min="1" max="52" value="${recurringEvent.instancesAhead || 12}" class="form-input w-32 px-4 py-3 rounded-lg text-white focus:outline-none">
                        <p class="text-sm text-gray-400 mt-1">Number of future instances to automatically create and display</p>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Series End Date (Optional)</label>
                        <input type="date" id="series-end-date" value="${recurringEvent.endDate || ''}" class="form-input w-64 px-4 py-3 rounded-lg text-white focus:outline-none">
                        <p class="text-sm text-gray-400 mt-1">Leave empty for no end date</p>
                    </div>
                </div>
            </div>
            
            <!-- Categories -->
            <div class="bg-gray-800/50 rounded-lg p-6">
                <h4 class="text-xl font-bold text-white mb-4">
                    <i class="fas fa-tags mr-2"></i>Categories
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    ${VALID_CATEGORIES.map(cat => `
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" name="recurring-categories" value="${cat}" ${(recurringEvent.category || recurringEvent.Category || []).includes(cat) ? 'checked' : ''} class="form-checkbox h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500">
                            <span class="text-gray-300 text-sm">${cat}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex justify-between items-center pt-6 border-t border-gray-700">
                <div class="flex gap-4">
                    <button onclick="handleEndRecurringSeries('${seriesId}')" class="btn-danger text-white px-6 py-3 rounded-lg transition-all">
                        <i class="fas fa-stop mr-2"></i>End Series
                    </button>
                    <button onclick="handleRegenerateInstances('${seriesId}')" class="bg-blue-900/50 border border-blue-700 text-blue-300 px-6 py-3 rounded-lg transition-all hover:bg-blue-800/50">
                        <i class="fas fa-sync mr-2"></i>Regenerate Instances
                    </button>
                </div>
                <div class="flex gap-4">
                    <button onclick="closeRecurringModal()" class="btn-secondary text-white px-6 py-3 rounded-lg transition-all">
                        <i class="fas fa-times mr-2"></i>Cancel
                    </button>
                    <button onclick="saveRecurringChanges('${seriesId}')" class="btn-primary text-white px-8 py-3 rounded-lg transition-all">
                        <i class="fas fa-save mr-2"></i>Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    
    // Add event listeners for form interactions
    setupRecurringModalEventListeners();
}

function closeRecurringModal() {
    const modal = document.getElementById('recurring-modal');
    modal.classList.add('hidden');
}

// Form handling
function populateEditForm(event) {
    console.log('Admin Edit Events: Populating form with event:', event);
    
    // Use standardized field names
    document.getElementById('edit-name').value = event.name || '';
    document.getElementById('edit-description').value = event.description || '';
    
    // Format date for HTML input
    const eventDate = event.date || '';
    const formattedDate = eventDate ? new Date(eventDate).toISOString().split('T')[0] : '';
    document.getElementById('edit-date').value = formattedDate;
    
    document.getElementById('edit-time').value = event.time || '';
    document.getElementById('edit-link').value = event.link || '';
    document.getElementById('edit-status').value = event.status || 'pending';
    
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
    
    // Handle venue selection (standardized field names)
    const venueSelect = document.getElementById('edit-venue');
    if (venueSelect) {
        venueSelect.innerHTML = '<option value="">Select a venue</option>';
        allVenues.forEach(venue => {
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
    
    // Handle recurring event fields (standardized)
    document.getElementById('edit-is-recurring').checked = event.isRecurring || false;
    document.getElementById('edit-recurring-pattern').value = event.recurringPattern || '';
    document.getElementById('edit-recurring-info').value = event.recurringInfo || '';
    
    // Format recurring dates
    const recurringStartDate = event.recurringStartDate || '';
    const formattedStartDate = recurringStartDate ? new Date(recurringStartDate).toISOString().split('T')[0] : '';
    document.getElementById('edit-recurring-start-date').value = formattedStartDate;
    
    const recurringEndDate = event.recurringEndDate || '';
    const formattedEndDate = recurringEndDate ? new Date(recurringEndDate).toISOString().split('T')[0] : '';
    document.getElementById('edit-recurring-end-date').value = formattedEndDate;
    
    document.getElementById('edit-total-instances').value = event.totalInstances || '';
    document.getElementById('edit-recurring-instance').value = event.recurringInstance || '';
    
    // Store current event for editing
    currentEventForEdit = event;
    
    // Show the modal
    document.getElementById('edit-modal').classList.remove('hidden');
}

async function handleEditFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData();
    
    // Basic event data
    formData.append('name', document.getElementById('edit-name').value);
    formData.append('description', document.getElementById('edit-description').value);
    formData.append('date', document.getElementById('edit-date').value);
    formData.append('time', document.getElementById('edit-time').value);
    formData.append('status', document.getElementById('edit-status').value);
    formData.append('link', document.getElementById('edit-link').value);
    
    // Categories
    const selectedCategories = Array.from(document.querySelectorAll('#edit-categories input:checked')).map(cb => cb.value);
    formData.append('categories', JSON.stringify(selectedCategories));
    
    // Venue handling
    const venueSelect = document.getElementById('edit-venue-select');
    if (venueSelect.value === 'new') {
        const newVenueName = document.getElementById('edit-new-venue-name').value;
        const newVenueAddress = document.getElementById('edit-new-venue-address').value;
        const newVenuePostcode = document.getElementById('edit-new-venue-postcode').value;
        const newVenueWebsite = document.getElementById('edit-new-venue-website').value;
        
        if (newVenueName && newVenueAddress) {
            formData.append('newVenue', JSON.stringify({
                name: newVenueName,
                address: newVenueAddress,
                postcode: newVenuePostcode,
                website: newVenueWebsite
            }));
        }
    } else if (venueSelect.value) {
        formData.append('venueId', venueSelect.value);
    }
    
    // Image handling
    const imageFile = document.getElementById('edit-image').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    // Recurring event data
    const isRecurring = document.getElementById('edit-is-recurring')?.checked || false;
    formData.append('isRecurring', isRecurring);
    
    if (isRecurring) {
        const recurringPattern = document.getElementById('edit-recurring-pattern')?.value || '';
        const recurringInfo = document.getElementById('edit-recurring-info')?.value || '';
        const recurringStartDate = document.getElementById('edit-recurring-start-date')?.value || '';
        const recurringEndDate = document.getElementById('edit-recurring-end-date')?.value || '';
        const totalInstances = document.getElementById('edit-total-instances')?.value || '';
        const recurringInstance = document.getElementById('edit-recurring-instance')?.value || '';
        
        formData.append('recurringPattern', recurringPattern);
        formData.append('recurringInfo', recurringInfo);
        formData.append('recurringStartDate', recurringStartDate);
        formData.append('recurringEndDate', recurringEndDate);
        formData.append('totalInstances', totalInstances);
        formData.append('recurringInstance', recurringInstance);
    }
    
    // Add event ID if editing
    if (currentEventForEdit) {
        formData.append('eventId', currentEventForEdit.id);
    }
    
    try {
        // Convert form data to JSON for Firestore function
        const eventData = {
            itemId: currentEventForEdit ? currentEventForEdit.id : null,
            itemType: 'event',
            'event-name': document.getElementById('edit-name').value,
            description: document.getElementById('edit-description').value,
            date: document.getElementById('edit-date').value,
            time: document.getElementById('edit-time').value,
            status: document.getElementById('edit-status').value,
            link: document.getElementById('edit-link').value,
            category: Array.from(document.querySelectorAll('#edit-categories input:checked')).map(cb => cb.value).join(',')
        };
        
        // Handle venue
        const venueSelect = document.getElementById('edit-venue-select');
        if (venueSelect.value === 'new') {
            const newVenueName = document.getElementById('edit-new-venue-name').value;
            if (newVenueName) {
                eventData['venue-name'] = newVenueName;
            }
        } else if (venueSelect.value) {
            eventData.venueId = venueSelect.value;
        }
        
        const response = await fetch('/.netlify/functions/update-item-firestore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });
        
        if (response.ok) {
            showSuccess('Event updated successfully!');
            closeEditModal();
            await loadAllEvents(); // Refresh the events list
        } else {
            const errorData = await response.json();
            showError(`Failed to update event: ${errorData.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error updating event:', error);
        showError('Failed to update event. Please try again.');
    }
}

async function handleDeleteEvent(eventId) {
    const event = eventId ? allEvents.find(e => e.id === eventId) : currentEventForEdit;
    if (!event) {
        console.error('Admin Edit Events: No event found for deletion');
        return;
    }
    
    console.log('Admin Edit Events: Deleting event:', event.id, event.name);
    
    // Check if this is a recurring event
    const isRecurring = event.isRecurring || event.isRecurringGroup || event.recurringGroupId || event.seriesId;
    
    let deleteSeries = false;
    let confirmMessage = `Are you sure you want to delete "${event.name || event['Event Name']}"? This action cannot be undone.`;
    
    if (isRecurring) {
        const seriesChoice = confirm(
            `This is a recurring event. Do you want to:\n\n` +
            `Click OK to delete the entire series (all instances)\n` +
            `Click Cancel to delete only this single instance`
        );
        
        if (seriesChoice) {
            deleteSeries = true;
            confirmMessage = `Are you sure you want to delete the ENTIRE recurring series "${event.name || event['Event Name']}"? This will delete ALL instances and cannot be undone.`;
        } else {
            confirmMessage = `Are you sure you want to delete this single instance of "${event.name || event['Event Name']}"? This action cannot be undone.`;
        }
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/delete-event-firestore', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventId: event.id,
                deleteSeries: deleteSeries
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete event');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message || 'Event deleted successfully!');
            closeEditModal();
            
            // Small delay to ensure deletion is processed
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Force refresh with current filter
            console.log('Admin Edit Events: Refreshing events after deletion...');
            
            // Clear current data to force fresh load
            allEvents = [];
            pendingEvents = [];
            approvedEvents = [];
            recurringEvents = [];
            
            await loadAllEvents(); // Reload data
            
            // Ensure the current filter is reapplied
            console.log('Admin Edit Events: Reapplying filter:', currentFilter);
            filterEvents(currentFilter);
            
            // Clear any selected events and current event
            selectedEvents.clear();
            currentEventForEdit = null;
            updateBulkActionsVisibility();
        } else {
            throw new Error(result.message || 'Failed to delete event');
        }
        
    } catch (error) {
        console.error('Error deleting event:', error);
        showError(`Error deleting event: ${error.message}`);
    }
}

function setupRecurringModalEventListeners() {
    // Venue selection handling
    const venueSelect = document.getElementById('recurring-venue');
    const newVenueFields = document.getElementById('new-venue-fields');
    
    if (venueSelect) {
        venueSelect.addEventListener('change', function() {
            if (this.value === 'new') {
                newVenueFields.classList.remove('hidden');
            } else {
                newVenueFields.classList.add('hidden');
            }
        });
    }
    
    // Recurrence type handling
    const recurrenceTypeRadios = document.querySelectorAll('input[name="recurrence-type"]');
    const weeklyOptions = document.getElementById('weekly-options');
    const monthlyOptions = document.getElementById('monthly-options');
    
    recurrenceTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            weeklyOptions.classList.add('hidden');
            monthlyOptions.classList.add('hidden');
            
            if (this.value === 'weekly') {
                weeklyOptions.classList.remove('hidden');
            } else if (this.value === 'monthly') {
                monthlyOptions.classList.remove('hidden');
            }
        });
    });
    
    // Monthly type handling
    const monthlyTypeRadios = document.querySelectorAll('input[name="monthly-type"]');
    const monthlyByDateOptions = document.getElementById('monthly-by-date-options');
    const monthlyByDayOptions = document.getElementById('monthly-by-day-options');
    
    monthlyTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'date') {
                monthlyByDateOptions.classList.remove('hidden');
                monthlyByDayOptions.classList.add('hidden');
            } else if (this.value === 'day') {
                monthlyByDateOptions.classList.add('hidden');
                monthlyByDayOptions.classList.remove('hidden');
            }
        });
    });
    
    // Image preview
    const imageInput = document.getElementById('recurring-image');
    const currentImage = document.getElementById('current-image');
    const imagePlaceholder = currentImage.nextElementSibling;
    
    if (imageInput && !imageInput.disabled) {
        imageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    currentImage.src = e.target.result;
                    currentImage.style.display = 'block';
                    imagePlaceholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

async function saveRecurringChanges(seriesId) {
    try {
        // Collect form data
        const data = {
            seriesId: seriesId,
            type: 'RecurringEvent'
        };
        
        // Basic information
        data.name = document.getElementById('recurring-name').value;
        data.description = document.getElementById('recurring-description').value;
        
        // Venue handling
        const venueSelect = document.getElementById('recurring-venue');
        if (venueSelect.value === 'new') {
            const newVenueName = document.getElementById('new-venue-name').value;
            const newVenueAddress = document.getElementById('new-venue-address').value;
            const newVenuePostcode = document.getElementById('new-venue-postcode').value;
            const newVenueWebsite = document.getElementById('new-venue-website').value;

            if (newVenueName && newVenueAddress) {
                data.newVenue = {
                    name: newVenueName,
                    address: newVenueAddress,
                    postcode: newVenuePostcode,
                    website: newVenueWebsite
                };
            }
        } else if (venueSelect.value) {
            data.venueId = venueSelect.value;
        }
        
        // Recurrence rules
        const recurrenceType = document.querySelector('input[name="recurrence-type"]:checked').value;
        const recurringInfo = { type: recurrenceType };
        
        if (recurrenceType === 'weekly') {
            const selectedDays = Array.from(document.querySelectorAll('input[name="weekly-days"]:checked'))
                .map(cb => parseInt(cb.value));
            recurringInfo.days = selectedDays;
        } else if (recurrenceType === 'monthly') {
            const monthlyType = document.querySelector('input[name="monthly-type"]:checked').value;
            recurringInfo.monthlyType = monthlyType;
            
            if (monthlyType === 'date') {
                recurringInfo.dayOfMonth = parseInt(document.getElementById('monthly-day-of-month').value);
            } else if (monthlyType === 'day') {
                recurringInfo.week = parseInt(document.getElementById('monthly-week').value);
                recurringInfo.dayOfWeek = parseInt(document.getElementById('monthly-day-of-week').value);
            }
        }
        
        data.recurringInfo = recurringInfo;
        
        // Instance management
        data.instancesAhead = document.getElementById('instances-ahead').value;
        data.endDate = document.getElementById('series-end-date').value;
        
        // Categories
        const selectedCategories = Array.from(document.querySelectorAll('input[name="recurring-categories"]:checked'))
            .map(cb => cb.value);
        data.categories = selectedCategories;
        
        // Send to backend as JSON
        const response = await fetch('/.netlify/functions/update-recurring-series', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showSuccess('Recurring series updated successfully');
            closeRecurringModal();
            await loadAllEvents();
        } else {
            let errorMessage = `Failed to update series: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.details) {
                    errorMessage = `Failed to update series: ${errorData.details}`;
                }
            } catch (e) {
                // If we can't parse the error response, use the default message
            }
            showError(errorMessage);
        }
        
    } catch (error) {
        console.error('Error saving recurring changes:', error);
        showError(`Error saving changes: ${error.message}`);
    }
}

async function handleEndRecurringSeries(seriesId) {
    if (!confirm('Are you sure you want to end this recurring series? This will mark all future instances as cancelled.')) {
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/end-recurring-series', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                seriesId: seriesId
            })
        });
        
        if (response.ok) {
            showSuccess('Recurring series ended successfully');
            closeRecurringModal();
            await loadAllEvents();
        } else {
            const error = await response.text();
            showError(`Failed to end series: ${error}`);
        }
        
    } catch (error) {
        console.error('Error ending recurring series:', error);
        showError(`Error ending series: ${error.message}`);
    }
}

async function handleRegenerateInstances(seriesId) {
    if (!confirm('This will regenerate all future instances based on the current recurrence rules. Continue?')) {
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/regenerate-instances', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                seriesId: seriesId
            })
        });
        
        if (response.ok) {
            showSuccess('Instances regenerated successfully');
            await loadAllEvents();
        } else {
            const error = await response.text();
            showError(`Failed to regenerate instances: ${error}`);
        }
        
    } catch (error) {
        console.error('Error regenerating instances:', error);
        showError(`Error regenerating instances: ${error.message}`);
    }
}

function handleBulkActions() {
    if (selectedEvents.size === 0) {
        showError('Please select at least one event for bulk actions');
        return;
    }
    
    openBulkActionsModal();
}

function updateBulkActionsVisibility() {
    const bulkActionsBtn = document.getElementById('bulk-actions-btn');
    if (bulkActionsBtn) {
        if (selectedEvents.size > 0) {
            bulkActionsBtn.innerHTML = `<i class="fas fa-tasks mr-2"></i>Bulk Actions (${selectedEvents.size})`;
            bulkActionsBtn.classList.remove('btn-secondary');
            bulkActionsBtn.classList.add('btn-primary');
        } else {
            bulkActionsBtn.innerHTML = `<i class="fas fa-tasks mr-2"></i>Bulk Actions`;
            bulkActionsBtn.classList.remove('btn-primary');
            bulkActionsBtn.classList.add('btn-secondary');
        }
    }
}

function openBulkActionsModal() {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 modal-backdrop flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
        <div class="modal-content rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-anton text-3xl text-white">
                    <i class="fas fa-tasks mr-3"></i>Bulk Actions
                </h3>
                <button class="close-bulk-modal-btn text-gray-400 hover:text-white text-2xl transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="space-y-6">
                <div class="bg-gray-800/50 rounded-lg p-6">
                    <h4 class="text-xl font-bold text-white mb-4">Selected Events (${selectedEvents.size})</h4>
                    <div class="space-y-2 max-h-40 overflow-y-auto">
                        ${Array.from(selectedEvents).map(eventId => {
                            const event = allEvents.find(e => e.id === eventId);
                            return event ? `
                                <div class="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                                    <span class="text-gray-300">${event.name || event['Event Name'] || 'Untitled Event'}</span>
                                    <span class="text-gray-400 text-sm">${event.status || event.Status || 'Unknown'}</span>
                                </div>
                            ` : '';
                        }).join('')}
                    </div>
                </div>
                
                <div class="bg-gray-800/50 rounded-lg p-6">
                    <h4 class="text-xl font-bold text-white mb-4">Available Actions</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onclick="handleBulkStatusChange('Approved')" class="btn-primary text-white p-4 rounded-lg transition-all text-left">
                            <i class="fas fa-check-circle mr-2"></i>
                            <div class="font-bold">Approve All</div>
                            <div class="text-sm opacity-75">Mark all selected events as approved</div>
                        </button>
                        
                        <button onclick="handleBulkStatusChange('Rejected')" class="btn-danger text-white p-4 rounded-lg transition-all text-left">
                            <i class="fas fa-times-circle mr-2"></i>
                            <div class="font-bold">Reject All</div>
                            <div class="text-sm opacity-75">Mark all selected events as rejected</div>
                        </button>
                        
                        <button onclick="handleBulkDelete()" class="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg transition-all text-left hover:bg-red-800/50">
                            <i class="fas fa-trash mr-2"></i>
                            <div class="font-bold">Delete All</div>
                            <div class="text-sm opacity-75">Permanently delete all selected events</div>
                        </button>
                        
                        <button onclick="handleBulkCategoryUpdate()" class="btn-secondary text-white p-4 rounded-lg transition-all text-left">
                            <i class="fas fa-tags mr-2"></i>
                            <div class="font-bold">Update Categories</div>
                            <div class="text-sm opacity-75">Add/remove categories from all events</div>
                        </button>
                    </div>
                </div>
                
                <div class="flex justify-end gap-4">
                    <button class="close-bulk-modal-btn btn-secondary text-white px-6 py-3 rounded-lg transition-all">
                        <i class="fas fa-times mr-2"></i>Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.close-bulk-modal-btn').addEventListener('click', () => {
        modal.remove();
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function handleBulkStatusChange(newStatus) {
    if (!confirm(`Are you sure you want to mark all ${selectedEvents.size} selected events as "${newStatus}"?`)) {
        return;
    }
    
    try {
        let successCount = 0;
        const eventIds = Array.from(selectedEvents);
        
        for (const eventId of eventIds) {
            const response = await fetch('/.netlify/functions/update-item-status-firestore-only', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    itemId: eventId,
                    newStatus: newStatus,
                    itemType: 'event'
                })
            });
            
            if (response.ok) {
                successCount++;
            }
        }
        
        showSuccess(`Successfully updated ${successCount} out of ${eventIds.length} events`);
        selectedEvents.clear();
        updateBulkActionsVisibility();
        await loadAllEvents();
        
        // Close modal
        document.querySelector('.modal-backdrop').remove();
        
    } catch (error) {
        console.error('Error in bulk status change:', error);
        showError(`Error updating events: ${error.message}`);
    }
}

async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to permanently delete all ${selectedEvents.size} selected events? This action cannot be undone.`)) {
        return;
    }
    
    try {
        let successCount = 0;
        const eventIds = Array.from(selectedEvents);
        
        for (const eventId of eventIds) {
            const response = await fetch('/.netlify/functions/delete-event-firestore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId: eventId,
                    deleteSeries: false // For bulk delete, only delete individual events
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    successCount++;
                }
            }
        }
        
        showSuccess(`Successfully deleted ${successCount} out of ${eventIds.length} events`);
        selectedEvents.clear();
        updateBulkActionsVisibility();
        await loadAllEvents();
        
        // Close modal
        document.querySelector('.modal-backdrop').remove();
        
    } catch (error) {
        console.error('Error in bulk delete:', error);
        showError(`Error deleting events: ${error.message}`);
    }
}

function handleBulkCategoryUpdate() {
    // This would open a modal for category selection
    showError('Bulk category update functionality not yet implemented');
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

// Convert to Recurring Functions
function openConvertToRecurringModal(eventId) {
    const modal = document.getElementById('convert-to-recurring-modal');
    const eventIdInput = document.getElementById('convert-event-id');
    const startDateInput = document.getElementById('convert-recurring-start-date');
    
    // Set the event ID
    eventIdInput.value = eventId;
    
    // Find the event data to get the actual event date
    const event = allEvents.find(e => e.id === eventId);
    if (event && event.date) {
        // Convert event date to YYYY-MM-DD format for the date input
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toISOString().split('T')[0];
        startDateInput.value = formattedDate;
    } else {
        // Fallback to today if no event date found
        const today = new Date().toISOString().split('T')[0];
        startDateInput.value = today;
    }
    
    // Show the modal
    modal.classList.remove('hidden');
    
    // Add event listeners
    document.getElementById('close-convert-modal-btn').onclick = closeConvertToRecurringModal;
    document.getElementById('cancel-convert-btn').onclick = closeConvertToRecurringModal;
    document.getElementById('convert-to-recurring-form').onsubmit = handleConvertToRecurringSubmit;
    
    // Handle custom pattern selection
    document.getElementById('convert-recurring-pattern').onchange = function() {
        const customPattern = document.getElementById('convert-custom-pattern');
        if (this.value === 'custom') {
            customPattern.classList.remove('hidden');
        } else {
            customPattern.classList.add('hidden');
        }
    };
}

function closeConvertToRecurringModal() {
    const modal = document.getElementById('convert-to-recurring-modal');
    modal.classList.add('hidden');
}

async function handleConvertToRecurringSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const eventId = formData.get('eventId');
    const recurringPattern = formData.get('recurringPattern');
    const customRecurrenceDesc = formData.get('customRecurrenceDesc');
    const recurringStartDate = formData.get('recurringStartDate');
    const recurringEndDate = formData.get('recurringEndDate');
    const maxInstances = formData.get('maxInstances');
    
    if (!recurringPattern) {
        showError('Please select a recurring pattern');
        return;
    }
    
    if (recurringPattern === 'custom' && !customRecurrenceDesc) {
        showError('Please provide a custom pattern description');
        return;
    }
    
    try {
        const response = await fetch('/.netlify/functions/convert-to-recurring', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventId: eventId,
                recurringPattern: recurringPattern,
                customRecurrenceDesc: customRecurrenceDesc,
                recurringStartDate: recurringStartDate,
                recurringEndDate: recurringEndDate || null,
                maxInstances: maxInstances ? parseInt(maxInstances) : null
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showSuccess(`Successfully converted event to recurring with ${result.totalInstances} instances`);
            closeConvertToRecurringModal();
            await loadAllEvents(); // Refresh the events list
        } else {
            showError(result.message || 'Failed to convert event to recurring');
        }
    } catch (error) {
        console.error('Error converting to recurring:', error);
        showError(`Error converting event to recurring: ${error.message}`);
    }
}

// Global functions for onclick handlers
window.openEditModal = openEditModal;
window.handleDeleteEvent = handleDeleteEvent;
window.openRecurringModal = openRecurringModal;
window.handleEndRecurringSeries = handleEndRecurringSeries;
window.saveRecurringChanges = saveRecurringChanges;
window.openConvertToRecurringModal = openConvertToRecurringModal;