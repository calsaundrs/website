const fs = require('fs');
const path = require('path');

// Event data - this could be fetched from the API in the future
const events = [
    {
        name: 'Drag Queen Bingo Night',
        slug: 'drag-queen-bingo-night',
        description: 'Join us for an evening of fabulous drag performances and exciting bingo games!',
        date: '2024-01-15T19:00:00Z',
        time: '7:00 PM',
        venueName: 'The Nightingale Club',
        venueSlug: 'the-nightingale-club',
        imageUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop&crop=center&auto=format&q=80',
        category: 'Drag',
        tags: [
            '<span class="category-tag">Drag</span>',
            '<span class="category-tag">Bingo</span>',
            '<span class="category-tag">Entertainment</span>'
        ],
        organizer: 'The Nightingale Club',
        websiteUrl: 'https://nightingaleclub.co.uk/events',
        ticketUrl: 'https://nightingaleclub.co.uk/tickets',
        price: '£5 entry',
        ageRestriction: '18+',
        accessibility: 'Wheelchair accessible',
        recurringInfo: 'Every Monday',
        isRecurring: true,
        isBoosted: false,
        descriptionSection: `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-white mb-4">About This Event</h2>
                <p class="text-gray-300 leading-relaxed">Join us for an evening of fabulous drag performances and exciting bingo games! Our talented drag queens will keep you entertained with their amazing performances while you play bingo for fantastic prizes. This is a must-attend event for anyone who loves drag culture and wants to have a great time!</p>
            </div>
        `,
        linksSection: `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-white mb-4">Event Links</h2>
                <a href="https://nightingaleclub.co.uk/events" target="_blank" rel="noopener noreferrer" class="inline-flex items-center bg-accent-color text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                    <i class="fas fa-external-link-alt mr-2"></i>
                    Visit Event Page
                </a>
            </div>
        `,
        otherInstancesSection: '',
        priceSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Price</h3>
                <p class="text-white">£5 entry</p>
            </div>
        `,
        ageRestrictionSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Age Restriction</h3>
                <p class="text-white">18+</p>
            </div>
        `,
        organizerSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Organizer</h3>
                <p class="text-white">The Nightingale Club</p>
            </div>
        `,
        recurringInfoSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recurring Info</h3>
                <p class="text-white">Every Monday</p>
            </div>
        `,
        accessibilitySection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Accessibility</h3>
                <p class="text-white">Wheelchair accessible</p>
            </div>
        `,
        ticketButton: `
            <a href="https://nightingaleclub.co.uk/tickets" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                <i class="fas fa-ticket-alt mr-2"></i>Get Tickets
            </a>
        `,
        recurringBadge: '<span class="recurring-event-tag">RECURRING</span>',
        boostedBadge: '',
        googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Drag+Queen+Bingo+Night&dates=20240115T190000Z/20240115T220000Z&details=Join+us+for+an+evening+of+fabulous+drag+performances+and+exciting+bingo+games!&location=The+Nightingale+Club',
        icalUrl: 'data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:20240115T190000Z%0ADTEND:20240115T220000Z%0ASUMMARY:Drag Queen Bingo Night%0ADESCRIPTION:Join us for an evening of fabulous drag performances and exciting bingo games!%0ALOCATION:The Nightingale Club%0AEND:VEVENT%0AEND:VCALENDAR'
    },
    {
        name: 'Live Music Night',
        slug: 'live-music-night',
        description: 'Experience amazing live music from local and touring artists.',
        date: '2024-01-20T20:00:00Z',
        time: '8:00 PM',
        venueName: 'Eden Bar',
        venueSlug: 'eden-bar',
        imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop&crop=center&auto=format&q=80',
        category: 'Live Music',
        tags: [
            '<span class="category-tag">Live Music</span>',
            '<span class="category-tag">Entertainment</span>'
        ],
        organizer: 'Eden Bar',
        websiteUrl: 'https://theedenbar.co.uk/events',
        ticketUrl: 'https://theedenbar.co.uk/tickets',
        price: 'Free entry',
        ageRestriction: '18+',
        accessibility: 'Wheelchair accessible',
        recurringInfo: 'Every Saturday',
        isRecurring: true,
        isBoosted: true,
        descriptionSection: `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-white mb-4">About This Event</h2>
                <p class="text-gray-300 leading-relaxed">Experience amazing live music from local and touring artists. Our stage hosts a variety of genres from rock and pop to jazz and acoustic. Come enjoy great music, drinks, and atmosphere in our intimate venue.</p>
            </div>
        `,
        linksSection: `
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-white mb-4">Event Links</h2>
                <a href="https://theedenbar.co.uk/events" target="_blank" rel="noopener noreferrer" class="inline-flex items-center bg-accent-color text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
                    <i class="fas fa-external-link-alt mr-2"></i>
                    Visit Event Page
                </a>
            </div>
        `,
        otherInstancesSection: '',
        priceSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Price</h3>
                <p class="text-white">Free entry</p>
            </div>
        `,
        ageRestrictionSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Age Restriction</h3>
                <p class="text-white">18+</p>
            </div>
        `,
        organizerSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Organizer</h3>
                <p class="text-white">Eden Bar</p>
            </div>
        `,
        recurringInfoSection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recurring Info</h3>
                <p class="text-white">Every Saturday</p>
            </div>
        `,
        accessibilitySection: `
            <div>
                <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Accessibility</h3>
                <p class="text-white">Wheelchair accessible</p>
            </div>
        `,
        ticketButton: `
            <a href="https://theedenbar.co.uk/tickets" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                <i class="fas fa-ticket-alt mr-2"></i>Get Tickets
            </a>
        `,
        recurringBadge: '<span class="recurring-event-tag">RECURRING</span>',
        boostedBadge: '<span class="boosted-listing-tag">BOOSTED</span>',
        googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Live+Music+Night&dates=20240120T200000Z/20240120T230000Z&details=Experience+amazing+live+music+from+local+and+touring+artists.&location=Eden+Bar',
        icalUrl: 'data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:20240120T200000Z%0ADTEND:20240120T230000Z%0ASUMMARY:Live Music Night%0ADESCRIPTION:Experience amazing live music from local and touring artists.%0ALOCATION:Eden Bar%0AEND:VEVENT%0AEND:VCALENDAR'
    }
];

// Read the template
const templatePath = path.join(__dirname, 'event-template.html');
const template = fs.readFileSync(templatePath, 'utf8');

// Function to generate an event page
function generateEventPage(event) {
    let content = template;
    
    // Replace all placeholders
    content = content.replace(/\{\{EVENT_NAME\}\}/g, event.name);
    content = content.replace(/\{\{EVENT_SLUG\}\}/g, event.slug);
    content = content.replace(/\{\{EVENT_DESCRIPTION\}\}/g, event.description);
    content = content.replace(/\{\{EVENT_DATE\}\}/g, formatEventDate(event.date));
    content = content.replace(/\{\{EVENT_TIME\}\}/g, event.time);
    content = content.replace(/\{\{EVENT_VENUE_NAME\}\}/g, event.venueName);
    content = content.replace(/\{\{EVENT_VENUE_SLUG\}\}/g, event.venueSlug);
    content = content.replace(/\{\{EVENT_IMAGE_URL\}\}/g, event.imageUrl);
    content = content.replace(/\{\{EVENT_CATEGORY\}\}/g, event.category);
    content = content.replace(/\{\{EVENT_TAGS\}\}/g, event.tags.join(''));
    content = content.replace(/\{\{EVENT_ORGANIZER\}\}/g, event.organizer);
    content = content.replace(/\{\{EVENT_WEBSITE_URL\}\}/g, event.websiteUrl);
    content = content.replace(/\{\{EVENT_TICKET_URL\}\}/g, event.ticketUrl);
    content = content.replace(/\{\{EVENT_PRICE\}\}/g, event.price);
    content = content.replace(/\{\{EVENT_AGE_RESTRICTION\}\}/g, event.ageRestriction);
    content = content.replace(/\{\{EVENT_ACCESSIBILITY\}\}/g, event.accessibility);
    content = content.replace(/\{\{EVENT_RECURRING_INFO\}\}/g, event.recurringInfo);
    
    // Replace conditional sections
    content = content.replace(/\{\{EVENT_DESCRIPTION_SECTION\}\}/g, event.descriptionSection);
    content = content.replace(/\{\{EVENT_LINKS_SECTION\}\}/g, event.linksSection);
    content = content.replace(/\{\{EVENT_OTHER_INSTANCES_SECTION\}\}/g, event.otherInstancesSection);
    content = content.replace(/\{\{EVENT_PRICE_SECTION\}\}/g, event.priceSection);
    content = content.replace(/\{\{EVENT_AGE_RESTRICTION_SECTION\}\}/g, event.ageRestrictionSection);
    content = content.replace(/\{\{EVENT_ORGANIZER_SECTION\}\}/g, event.organizerSection);
    content = content.replace(/\{\{EVENT_RECURRING_INFO_SECTION\}\}/g, event.recurringInfoSection);
    content = content.replace(/\{\{EVENT_ACCESSIBILITY_SECTION\}\}/g, event.accessibilitySection);
    content = content.replace(/\{\{EVENT_TICKET_BUTTON\}\}/g, event.ticketButton);
    content = content.replace(/\{\{EVENT_RECURRING_BADGE\}\}/g, event.recurringBadge);
    content = content.replace(/\{\{EVENT_BOOSTED_BADGE\}\}/g, event.boostedBadge);
    content = content.replace(/\{\{EVENT_GOOGLE_CALENDAR_URL\}\}/g, event.googleCalendarUrl);
    content = content.replace(/\{\{EVENT_ICAL_URL\}\}/g, event.icalUrl);
    
    return content;
}

// Function to format event date
function formatEventDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Function to update all event pages
function updateAllEventPages() {
    console.log('🔄 Updating all event pages from template...');
    
    // Create event directory if it doesn't exist
    const eventDir = path.join(__dirname, 'event');
    if (!fs.existsSync(eventDir)) {
        fs.mkdirSync(eventDir);
    }
    
    events.forEach(event => {
        const eventPath = path.join(eventDir, `${event.slug}.html`);
        const content = generateEventPage(event);
        
        fs.writeFileSync(eventPath, content);
        console.log(`✅ Updated: ${event.name} (${event.slug}.html)`);
    });
    
    console.log(`\n🎉 Successfully updated ${events.length} event pages!`);
}

// Function to generate a single event page
function generateSingleEventPage(eventSlug) {
    const event = events.find(e => e.slug === eventSlug);
    if (!event) {
        console.error(`❌ Event not found: ${eventSlug}`);
        return;
    }
    
    // Create event directory if it doesn't exist
    const eventDir = path.join(__dirname, 'event');
    if (!fs.existsSync(eventDir)) {
        fs.mkdirSync(eventDir);
    }
    
    const eventPath = path.join(eventDir, `${event.slug}.html`);
    const content = generateEventPage(event);
    
    fs.writeFileSync(eventPath, content);
    console.log(`✅ Generated: ${event.name} (${event.slug}.html)`);
}

// Function to list all events
function listEvents() {
    console.log('📋 Available events:');
    events.forEach(event => {
        console.log(`  • ${event.name} (${event.slug})`);
    });
}

// Command line interface
const command = process.argv[2];
const eventSlug = process.argv[3];

switch (command) {
    case 'update-all':
        updateAllEventPages();
        break;
    case 'generate':
        if (!eventSlug) {
            console.error('❌ Please provide an event slug');
            console.log('Usage: node generate-event-pages.js generate <event-slug>');
            break;
        }
        generateSingleEventPage(eventSlug);
        break;
    case 'list':
        listEvents();
        break;
    default:
        console.log('🎪 Event Page Generator');
        console.log('');
        console.log('Commands:');
        console.log('  node generate-event-pages.js update-all     - Update all event pages from template');
        console.log('  node generate-event-pages.js generate <slug> - Generate a single event page');
        console.log('  node generate-event-pages.js list           - List all available events');
        console.log('');
        console.log('Examples:');
        console.log('  node generate-event-pages.js update-all');
        console.log('  node generate-event-pages.js generate drag-queen-bingo-night');
        console.log('  node generate-event-pages.js list');
}