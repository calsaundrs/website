const fs = require('fs');
const path = require('path');

const venues = [
    { name: 'Equator Bar', slug: 'equator-bar' },
    { name: 'Glamorous', slug: 'glamorous' },
    { name: 'Missing Bar', slug: 'missing-bar' },
    { name: 'Sidewalk', slug: 'sidewalk' },
    { name: 'The Fountain inn', slug: 'the-fountain-inn' },
    { name: 'The Fox', slug: 'the-fox' },
    { name: 'The Village Inn', slug: 'the-village-inn' },
    { name: 'Eden Bar', slug: 'eden-bar' }
];

const newEventsScript = `
    <script>
        // Load events for this venue with separate sections for recurring and one-off events
        async function loadVenueEvents() {
            try {
                const response = await fetch('/.netlify/functions/get-events-by-venue?venueSlug={{VENUE_SLUG}}');
                if (!response.ok) throw new Error('Failed to fetch events');
                const data = await response.json();
                
                const eventsContainer = document.getElementById('events-container');
                
                if (data.success && data.events.length > 0) {
                    // Separate recurring and one-off events
                    const recurringEvents = data.events.filter(event => event.isRecurringGroup || event.isRecurring || event.recurringInfo || event.recurringPattern);
                    const oneOffEvents = data.events.filter(event => !event.isRecurringGroup && !event.isRecurring && !event.recurringInfo && !event.recurringPattern);
                    
                    let eventsHTML = '';
                    
                    // Recurring Events Section
                    if (recurringEvents.length > 0) {
                        eventsHTML += \`
                            <div class="mb-8">
                                <h3 class="text-2xl font-bold text-white mb-6 flex items-center">
                                    <i class="fas fa-redo mr-3 text-green-400"></i>
                                    Regular Events
                                    <span class="ml-3 bg-green-500/20 text-green-300 text-sm px-3 py-1 rounded-full">\${recurringEvents.length} event\${recurringEvents.length !== 1 ? 's' : ''}</span>
                                </h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    \${recurringEvents.map(event => renderEventCard(event, true)).join('')}
                                </div>
                            </div>
                        \`;
                    }
                    
                    // One-off Events Section
                    if (oneOffEvents.length > 0) {
                        eventsHTML += \`
                            <div class="mb-8">
                                <h3 class="text-2xl font-bold text-white mb-6 flex items-center">
                                    <i class="fas fa-calendar-day mr-3 text-blue-400"></i>
                                    Upcoming Events
                                    <span class="ml-3 bg-blue-500/20 text-blue-300 text-sm px-3 py-1 rounded-full">\${oneOffEvents.length} event\${oneOffEvents.length !== 1 ? 's' : ''}</span>
                                </h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    \${oneOffEvents.map(event => renderEventCard(event, false)).join('')}
                                </div>
                            </div>
                        \`;
                    }
                    
                    eventsContainer.innerHTML = eventsHTML;
                    
                } else {
                    eventsContainer.innerHTML = \`
                        <div class="text-center py-16">
                            <div class="w-32 h-32 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-8">
                                <i class="fas fa-calendar-times text-4xl text-gray-600"></i>
                            </div>
                            <h3 class="text-2xl font-bold text-white mb-4">No Upcoming Events</h3>
                            <p class="text-gray-400 mb-8 text-lg">Check back soon for new events, or try adjusting your filters.</p>
                            <a href="/promoter-tool" class="btn-primary text-white px-8 py-4 rounded-lg font-semibold inline-flex items-center text-lg">
                                <i class="fas fa-plus mr-3"></i>Submit an Event
                            </a>
                        </div>
                    \`;
                }
            } catch (error) {
                console.error('Error loading events:', error);
                document.getElementById('events-container').innerHTML = \`
                    <div class="text-center py-16">
                        <div class="w-32 h-32 bg-gradient-to-br from-red-600/20 to-pink-600/20 rounded-full flex items-center justify-center mx-auto mb-8">
                            <i class="fas fa-exclamation-triangle text-4xl text-red-500"></i>
                        </div>
                        <h3 class="text-2xl font-bold text-white mb-4">Error Loading Events</h3>
                        <p class="text-gray-400 text-lg">We're having trouble loading events right now. Please try again later.</p>
                    </div>
                \`;
            }
        }
        
        function renderEventCard(event, isRecurring) {
            const tagsHTML = event.category && event.category.length > 0 ? 
                event.category.map(cat => \`<span class="inline-block bg-blue-100/20 text-blue-300 text-xs px-2 py-1 rounded-full flex-shrink-0">\${cat}</span>\`).join('') : '';
            const imageUrl = event.image ? (typeof event.image === 'string' ? event.image : event.image.url) : 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=600&fit=crop&crop=center&auto=format&q=80';
            const isBoosted = event.promotion && event.promotion.boosted;
            const venueName = event.venueName || 'TBC';
            
            let eventDate = new Date(event.date);
            let formattedDate = eventDate.toLocaleDateString('en-GB', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });

            // Handle recurring event display
            let recurringBadge = '';
            
            if (isRecurring) {
                if (event.isRecurringGroup) {
                    // This is a grouped recurring event
                    const pattern = event.recurringPattern;
                    const instanceCount = event.instances ? event.instances.length : 0;
                    const nextOccurrence = event.nextOccurrence ? new Date(event.nextOccurrence) : null;
                    
                    // Create pattern label
                    let patternLabel = '';
                    switch (pattern) {
                        case 'weekly':
                            patternLabel = 'Weekly Event';
                            break;
                        case 'monthly':
                            patternLabel = 'Monthly Event';
                            break;
                        case 'daily':
                            patternLabel = 'Daily Event';
                            break;
                        case 'bi-weekly':
                            patternLabel = 'Bi-Weekly Event';
                            break;
                        case 'yearly':
                            patternLabel = 'Annual Event';
                            break;
                        default:
                            patternLabel = 'Recurring Event';
                    }
                    
                    // Add instance count if multiple instances
                    if (instanceCount > 1) {
                        patternLabel += \` (\${instanceCount} upcoming)\`;
                    }
                    
                    recurringBadge = \`<div class="absolute top-4 right-4 z-10"><span class="bg-gradient-to-r from-green-500 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full"><i class="fas fa-redo mr-1"></i>\${patternLabel}</span></div>\`;
                    
                    // Update date to show next occurrence
                    if (nextOccurrence) {
                        formattedDate = nextOccurrence.toLocaleDateString('en-GB', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        });
                    }
                    
                } else if (event.recurringInfo || event.recurringPattern) {
                    // Individual recurring event
                    const pattern = event.recurringPattern || extractRecurringPattern(event.recurringInfo);
                    let patternLabel = '';
                    
                    switch (pattern) {
                        case 'weekly':
                            patternLabel = 'Weekly Event';
                            break;
                        case 'monthly':
                            patternLabel = 'Monthly Event';
                            break;
                        case 'daily':
                            patternLabel = 'Daily Event';
                            break;
                        case 'bi-weekly':
                            patternLabel = 'Bi-Weekly Event';
                            break;
                        case 'yearly':
                            patternLabel = 'Annual Event';
                            break;
                        default:
                            patternLabel = 'Recurring Event';
                    }
                    
                    recurringBadge = \`<div class="absolute top-4 right-4 z-10"><span class="bg-gradient-to-r from-green-500 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full"><i class="fas fa-redo mr-1"></i>\${patternLabel}</span></div>\`;
                }
            }

            return \`
                <div class="venue-card rounded-xl overflow-hidden relative">
                    \${isBoosted ? '<div class="absolute top-4 left-4 z-10"><span class="bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full"><i class="fas fa-star mr-1"></i>Featured</span></div>' : ''}
                    \${recurringBadge}
                    <div class="aspect-[2/1] bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center overflow-hidden">
                        <img src="\${imageUrl}" alt="\${event.name}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=600&fit=crop&crop=center&auto=format&q=80'">
                    </div>
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm text-gray-400">\${formattedDate}</span>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-2 text-left" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 3rem; line-height: 1.5rem;">\${event.name}</h3>
                        <p class="text-gray-400 text-sm mb-3 text-left">\${venueName}</p>
                        <div class="flex gap-1 mb-4 overflow-hidden">
                            \${tagsHTML}
                        </div>
                        <div class="flex justify-between items-center">
                            <a href="/event/\${event.slug}" class="btn-primary text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-eye mr-1"></i>View Details
                            </a>
                            <button class="btn-secondary text-white px-3 py-2 rounded-lg text-sm">
                                <i class="fas fa-share"></i>
                            </button>
                        </div>
                    </div>
                </div>\`;
        }

        // Helper function to extract recurring pattern (fallback)
        function extractRecurringPattern(recurringInfo) {
            if (!recurringInfo) return null;
            
            const text = recurringInfo.toLowerCase();
            if (text.includes('weekly') || text.includes('every week')) {
                return 'weekly';
            } else if (text.includes('monthly') || text.includes('every month')) {
                return 'monthly';
            } else if (text.includes('daily') || text.includes('every day')) {
                return 'daily';
            } else if (text.includes('bi-weekly') || text.includes('every two weeks')) {
                return 'bi-weekly';
            } else if (text.includes('yearly') || text.includes('annual')) {
                return 'yearly';
            } else {
                return 'recurring';
            }
        }

        // Load events when page loads
        document.addEventListener('DOMContentLoaded', loadVenueEvents);
    </script>`;

venues.forEach(venue => {
    const filePath = path.join(__dirname, 'venue', `${venue.slug}.html`);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        const oldScriptPattern = /<script>[\s\S]*?loadVenueEvents[\s\S]*?<\/script>/;
        const newScript = newEventsScript.replace('{{VENUE_SLUG}}', venue.slug);
        
        if (oldScriptPattern.test(content)) {
            content = content.replace(oldScriptPattern, newScript);
            fs.writeFileSync(filePath, content);
            console.log(`Updated: ${filePath}`);
        } else {
            console.log(`No script found to replace in: ${filePath}`);
        }
    } else {
        console.log(`File not found: ${filePath}`);
    }
});

console.log('All venue pages updated with separated recurring and one-off events display!');