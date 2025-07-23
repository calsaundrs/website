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

    // Debug: Log first event to see structure
    if (events.length > 0) {
        console.log('Admin Edit Events: First event structure:', events[0]);
        console.log('Admin Edit Events: Available fields:', Object.keys(events[0]));
    }

    const eventsHtml = events.map(event => {
        // Handle different possible status field names
        const status = event.status || event.Status || event['Status'] || 'Unknown';
        const statusBadge = getStatusBadge(status);
        const categoryBadges = (event.category || event.Category || []).map(cat => 
            `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1">${cat}</span>`
        ).join('');

        return `
            <div class="bg-white rounded-lg shadow-md p-6 mb-4 border-l-4 ${status === 'Approved' ? 'border-green-500' : status === 'Pending Review' ? 'border-yellow-500' : 'border-gray-400'}">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${event.name || event['Event Name'] || 'Untitled Event'}</h3>
                        <div class="flex items-center mb-2">
                            ${statusBadge}
                        </div>
                        <p class="text-gray-600 mb-2">${event.description || event.Description || 'No description'}</p>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            ${event.venue || event.VenueText || event['Venue Name'] || 'TBC'}
                        </div>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            ${formatDate(event.date || event.Date)}
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

    // Debug: Log first recurring event to see structure
    if (events.length > 0) {
        console.log('Admin Edit Events: First recurring event structure:', events[0]);
        console.log('Admin Edit Events: Available recurring event fields:', Object.keys(events[0]));
    }

    const eventsHtml = events.map(event => {
        // Handle different possible field names
        const status = event.status || event.Status || event['Status'] || 'Unknown';
        const statusBadge = getStatusBadge(status);
        const categoryBadges = (event.category || event.Category || []).map(cat => 
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
                        <h3 class="text-lg font-semibold text-gray-900 mb-2">${event.name || event['Event Name'] || 'Untitled Event'}</h3>
                        <div class="flex items-center mb-2">
                            ${activeBadge}
                            ${statusBadge}
                        </div>
                        <p class="text-gray-600 mb-2">${event.description || event.Description || 'No description'}</p>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            ${event.venue || event.VenueText || event['Venue Name'] || 'TBC'}
                        </div>
                        <div class="flex items-center text-sm text-gray-500 mb-2">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            ${event.recurringInfo || event['Recurring Info'] || 'Recurring Event'}
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
async function editEvent(eventId) {
    console.log(`Admin Edit Events: Editing event ${eventId}`);
    
    // Find the event in our data
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        alert('Event not found!');
        return;
    }
    
    // For now, show event details and allow basic editing
    const newName = prompt('Edit event name:', event.name || event['Event Name'] || '');
    if (newName === null) return; // User cancelled
    
    const newDescription = prompt('Edit event description:', event.description || event.Description || '');
    if (newDescription === null) return; // User cancelled
    
    try {
        // Create form data for the update
        const formData = new FormData();
        formData.append('id', eventId);
        formData.append('type', 'Event');
        formData.append('Event Name', newName);
        formData.append('Description', newDescription);
        
        const response = await fetch('/.netlify/functions/update-submission', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('Event updated successfully!');
            // Reload events to show changes
            await loadAllEvents();
        } else {
            const error = await response.json();
            alert(`Error updating event: ${error.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error updating event:', error);
        alert(`Error updating event: ${error.message}`);
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
        return;
    }
    
    console.log(`Admin Edit Events: Deleting event ${eventId}`);
    
    try {
        const response = await fetch('/.netlify/functions/delete-submission', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: eventId,
                type: 'Event'
            })
        });
        
        if (response.ok) {
            alert('Event deleted successfully!');
            // Reload events to show changes
            await loadAllEvents();
        } else {
            const error = await response.json();
            alert(`Error deleting event: ${error.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error deleting event:', error);
        alert(`Error deleting event: ${error.message}`);
    }
}

async function editRecurringEvent(seriesId) {
    console.log(`Admin Edit Events: Editing recurring series ${seriesId}`);
    
    // Find the recurring event
    const recurringEvent = recurringEvents.find(e => (e.seriesId || e.id) === seriesId);
    if (!recurringEvent) {
        alert('Recurring event not found!');
        return;
    }
    
    // For now, show series details and allow basic editing
    const newName = prompt('Edit series name:', recurringEvent.name || recurringEvent['Event Name'] || '');
    if (newName === null) return; // User cancelled
    
    const newDescription = prompt('Edit series description:', recurringEvent.description || recurringEvent.Description || '');
    if (newDescription === null) return; // User cancelled
    
    try {
        // Update the parent event (first instance with recurring info)
        const parentEvent = recurringEvent.instances ? 
            recurringEvent.instances.find(instance => instance.recurringInfo) : 
            { id: seriesId };
        
        if (parentEvent) {
            const formData = new FormData();
            formData.append('id', parentEvent.id);
            formData.append('type', 'Event');
            formData.append('Event Name', newName);
            formData.append('Description', newDescription);
            
            const response = await fetch('/.netlify/functions/update-submission', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                alert('Recurring series updated successfully!');
                // Reload events to show changes
                await loadAllEvents();
            } else {
                const error = await response.json();
                alert(`Error updating series: ${error.message || 'Unknown error'}`);
            }
        } else {
            alert('Could not find parent event to update');
        }
    } catch (error) {
        console.error('Error updating recurring series:', error);
        alert(`Error updating series: ${error.message}`);
    }
}

async function endRecurringSeries(seriesId) {
    if (!confirm('Are you sure you want to end this recurring series? This will mark all future instances as ended.')) {
        return;
    }
    
    console.log(`Admin Edit Events: Ending recurring series ${seriesId}`);
    
    try {
        // Find all future instances and mark them as ended
        const recurringEvent = recurringEvents.find(e => (e.seriesId || e.id) === seriesId);
        if (!recurringEvent || !recurringEvent.instances) {
            alert('Recurring event not found or no instances available!');
            return;
        }
        
        const futureInstances = recurringEvent.instances.filter(instance => !instance.isPast);
        
        if (futureInstances.length === 0) {
            alert('No future instances to end');
            return;
        }
        
        // Update each future instance to mark it as ended
        let updatedCount = 0;
        for (const instance of futureInstances) {
            const formData = new FormData();
            formData.append('id', instance.id);
            formData.append('type', 'Event');
            formData.append('Status', 'Ended');
            
            const response = await fetch('/.netlify/functions/update-submission', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                updatedCount++;
            }
        }
        
        alert(`Successfully ended ${updatedCount} future instances of the series!`);
        // Reload events to show changes
        await loadAllEvents();
        
    } catch (error) {
        console.error('Error ending recurring series:', error);
        alert(`Error ending series: ${error.message}`);
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