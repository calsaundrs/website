// Admin Edit Events JavaScript
let allEvents = [];
let pendingEvents = [];
let approvedEvents = [];
let recurringEvents = [];
let currentFilter = 'all';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Admin Edit Events: Initializing...');
    loadAllEvents();
    setupFilterButtons();
});

// Setup filter button event listeners
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('[data-filter]');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            setActiveFilter(filter);
            filterEvents(filter);
        });
    });
}

// Set active filter button
function setActiveFilter(filter) {
    currentFilter = filter;
    
    // Update button states
    document.querySelectorAll('[data-filter]').forEach(button => {
        button.classList.remove('bg-blue-600', 'text-white');
        button.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    // Set active button
    const activeButton = document.querySelector(`[data-filter="${filter}"]`);
    if (activeButton) {
        activeButton.classList.remove('bg-gray-200', 'text-gray-700');
        activeButton.classList.add('bg-blue-600', 'text-white');
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
        if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            allEvents = eventsData.events || [];
            
            // Separate pending and approved events
            pendingEvents = allEvents.filter(event => event.status === 'Pending Review');
            approvedEvents = allEvents.filter(event => event.status === 'Approved');
            
            console.log(`Admin Edit Events: Loaded ${allEvents.length} total events (${pendingEvents.length} pending, ${approvedEvents.length} approved)`);
        }
        
        // Load recurring events
        const recurringResponse = await fetch('/.netlify/functions/get-recurring-events');
        if (recurringResponse.ok) {
            const recurringData = await recurringResponse.json();
            recurringEvents = recurringData.recurringEvents || [];
            console.log(`Admin Edit Events: Loaded ${recurringEvents.length} recurring events`);
        }
        
        // Render initial view
        filterEvents(currentFilter);
        
    } catch (error) {
        console.error('Admin Edit Events: Error loading events:', error);
        showError('Failed to load events. Please try again.');
    }
}

// Render regular events
function renderEvents(events) {
    const container = document.getElementById('events-container');
    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500">No events found.</p>
            </div>
        `;
        return;
    }

    const eventsHtml = events.map(event => {
        const statusBadge = getStatusBadge(event.status);
        const categoryBadges = (event.category || []).map(cat => 
            `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">${cat}</span>`
        ).join('');

        return `
            <div class="bg-white rounded-lg shadow-md p-6 mb-4 border-l-4 ${event.status === 'Approved' ? 'border-green-500' : event.status === 'Pending Review' ? 'border-yellow-500' : 'border-gray-400'}">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${event.name}</h3>
                        <div class="flex items-center mb-2">
                            ${statusBadge}
                        </div>
                        <p class="text-gray-600 mb-2">${event.description || 'No description'}</p>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            ${event.venue}
                        </div>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            ${formatDate(event.date)}
                        </div>
                        <div class="mt-2">
                            ${categoryBadges}
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="editEvent('${event.id}')" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                            Edit
                        </button>
                        <button onclick="deleteEvent('${event.id}')" class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = eventsHtml;
}

// Render recurring events
function renderRecurringEvents(events) {
    const container = document.getElementById('recurring-events-container');
    if (!container) return;

    if (!events || events.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500">No recurring events found.</p>
            </div>
        `;
        return;
    }

    const eventsHtml = events.map(event => {
        const statusBadge = getStatusBadge(event.status);
        const categoryBadges = (event.category || []).map(cat => 
            `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">${cat}</span>`
        ).join('');
        
        const activeBadge = event.isActive ? 
            '<span class="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-2">Active</span>' :
            '<span class="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded mr-2">Ended</span>';
        
        const nextInstanceInfo = event.nextInstance ? 
            `<div class="text-sm text-gray-600 mt-2">
                <strong>Next:</strong> ${formatDate(event.nextInstance.date)} (${event.nextInstance.status})
            </div>` : '';
        
        const instanceCounts = `
            <div class="text-sm text-gray-600 mt-2">
                <strong>Instances:</strong> ${event.totalInstances} total 
                (${event.futureInstances} upcoming, ${event.pastInstances} past)
            </div>
        `;

        return `
            <div class="bg-white rounded-lg shadow-md p-6 mb-4 border-l-4 ${event.isActive ? 'border-green-500' : 'border-gray-400'}">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${event.name}</h3>
                        <div class="flex items-center mb-2">
                            ${activeBadge}
                            ${statusBadge}
                        </div>
                        <p class="text-gray-600 mb-2">${event.description || 'No description'}</p>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            ${event.venue}
                        </div>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            ${event.recurringInfo}
                        </div>
                        ${nextInstanceInfo}
                        ${instanceCounts}
                        <div class="mt-2">
                            ${categoryBadges}
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="editRecurringEvent('${event.seriesId || event.id}')" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                            Edit Series
                        </button>
                        <button onclick="endRecurringSeries('${event.seriesId || event.id}')" class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                            End Series
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
        'Approved': 'bg-green-100 text-green-800',
        'Pending Review': 'bg-yellow-100 text-yellow-800',
        'Rejected': 'bg-red-100 text-red-800'
    };
    
    const classes = statusClasses[status] || 'bg-gray-100 text-gray-800';
    return `<span class="inline-block ${classes} text-xs px-2 py-1 rounded">${status}</span>`;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'TBC';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Event management functions
function editEvent(eventId) {
    alert(`Edit event ${eventId} - Functionality coming soon!`);
}

function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event?')) {
        alert(`Delete event ${eventId} - Functionality coming soon!`);
    }
}

function editRecurringEvent(seriesId) {
    alert(`Edit recurring series ${seriesId} - Functionality coming soon!`);
}

function endRecurringSeries(seriesId) {
    if (confirm('Are you sure you want to end this recurring series? This will mark all future instances as ended.')) {
        alert(`End recurring series ${seriesId} - Functionality coming soon!`);
    }
}

// Show error message
function showError(message) {
    const errorContainer = document.getElementById('error-message');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.classList.remove('hidden');
        setTimeout(() => {
            errorContainer.classList.add('hidden');
        }, 5000);
    }
}