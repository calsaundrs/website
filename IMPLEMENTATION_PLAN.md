# Implementation Plan: Robust Event Series Management

## Phase 1: Immediate Fixes (Week 1-2)

### 1.1 Fix Current Slug Generation Issues

**Problem**: Current slug generation is inconsistent and breaks frequently.

**Solution**: Create a unified slug generation service.

```javascript
// netlify/functions/utils/slug-generator.js
class SlugGenerator {
  constructor() {
    this.reservedSlugs = new Set(['admin', 'api', 'event', 'events', 'venue', 'venues']);
  }

  generateSlug(eventName, options = {}) {
    const { includeDate = false, date = null, seriesId = null } = options;
    
    // Clean event name
    let slug = eventName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Add series identifier if provided
    if (seriesId) {
      slug = `${slug}-series-${seriesId.slice(-6)}`;
    }
    
    // Add date if requested and provided
    if (includeDate && date) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      slug = `${slug}-${dateStr}`;
    }
    
    // Ensure uniqueness
    if (this.reservedSlugs.has(slug)) {
      slug = `event-${slug}`;
    }
    
    return slug;
  }

  async ensureUniqueSlug(baseSlug, existingSlugs = []) {
    let slug = baseSlug;
    let counter = 1;
    
    while (existingSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }
}

module.exports = SlugGenerator;
```

### 1.2 Create Robust Event Service

**Problem**: Current event fetching is fragile and lacks error handling.

**Solution**: Implement a service layer with proper error handling and caching.

```javascript
// netlify/functions/services/event-service.js
const Airtable = require('airtable');
const SlugGenerator = require('../utils/slug-generator');

class EventService {
  constructor() {
    this.base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);
    this.slugGenerator = new SlugGenerator();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async getEventBySlug(slug, options = {}) {
    const cacheKey = `event:${slug}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Try multiple lookup strategies
      let event = await this.findEventBySlug(slug);
      
      if (!event) {
        // Fallback: search by name similarity
        event = await this.searchEventByName(slug);
      }
      
      if (!event) {
        throw new Error('Event not found');
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: event,
        timestamp: Date.now()
      });

      return event;
      
    } catch (error) {
      console.error('Error fetching event by slug:', error);
      throw new Error('Failed to load event');
    }
  }

  async findEventBySlug(slug) {
    const escapedSlug = slug.replace(/"/g, '"');
    
    const records = await this.base('Events').select({
      maxRecords: 10,
      filterByFormula: `{Slug} = "${escapedSlug}"`,
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date',
        'Venue', 'Venue Name', 'VenueText', 'Category', 'Description',
        'Address', 'Price', 'Age Restriction', 'Link', 'Status'
      ]
    }).firstPage();

    if (records.length === 0) return null;

    // Handle series events
    const parentEvent = records.find(record => record.fields['Recurring Info']);
    if (parentEvent) {
      return this.processSeriesEvent(parentEvent, records);
    }

    // Handle standalone events
    return this.processStandaloneEvent(records[0]);
  }

  async searchEventByName(searchTerm) {
    const escapedTerm = searchTerm.replace(/"/g, '"');
    
    const records = await this.base('Events').select({
      maxRecords: 5,
      filterByFormula: `FIND("${escapedTerm}", {Event Name})`,
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date',
        'Venue', 'Venue Name', 'VenueText', 'Category', 'Description'
      ]
    }).firstPage();

    if (records.length === 0) return null;

    // Return the most relevant match
    return this.processStandaloneEvent(records[0]);
  }

  processSeriesEvent(parentRecord, allRecords) {
    const fields = parentRecord.fields;
    const seriesId = parentRecord.id;
    
    // Get all future instances
    const futureInstances = allRecords
      .filter(record => new Date(record.fields.Date) > new Date())
      .sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));

    return {
      id: parentRecord.id,
      name: fields['Event Name'],
      slug: fields['Slug'],
      description: fields['Description'],
      recurringInfo: fields['Recurring Info'],
      category: fields['Category'] || [],
      venue: this.extractVenueInfo(fields),
      series: {
        id: seriesId,
        type: 'recurring',
        instances: futureInstances.map(instance => ({
          id: instance.id,
          date: instance.fields.Date,
          venue: this.extractVenueInfo(instance.fields)
        })),
        totalInstances: futureInstances.length
      },
      nextInstance: futureInstances[0] ? futureInstances[0].fields.Date : null
    };
  }

  processStandaloneEvent(record) {
    const fields = record.fields;
    
    return {
      id: record.id,
      name: fields['Event Name'],
      slug: fields['Slug'],
      description: fields['Description'],
      date: fields['Date'],
      category: fields['Category'] || [],
      venue: this.extractVenueInfo(fields),
      details: {
        price: fields['Price'],
        ageRestriction: fields['Age Restriction'],
        link: fields['Link']
      }
    };
  }

  extractVenueInfo(fields) {
    const venueName = fields['Venue Name'] ? 
      fields['Venue Name'][0] : 
      fields['VenueText'] || 'TBC';
    
    return {
      name: venueName,
      address: fields['Address']
    };
  }
}

module.exports = EventService;
```

### 1.3 Update get-event-details.js

**Problem**: Current function is complex and fragile.

**Solution**: Simplify using the new service layer.

```javascript
// netlify/functions/get-event-details.js
const EventService = require('./services/event-service');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

const eventService = new EventService();

exports.handler = async function (event, context) {
  const slug = event.path.split("/").pop();
  
  if (!slug) {
    return { 
      statusCode: 400, 
      body: 'Error: Event slug not provided.' 
    };
  }

  try {
    // Use the new service to get event data
    const eventData = await eventService.getEventBySlug(slug);
    
    if (!eventData) {
      return { 
        statusCode: 404, 
        body: 'Event not found.' 
      };
    }

    // Load and compile template
    const templatePath = path.join(__dirname, 'templates', 'event-details-template.html');
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);

    // Prepare template data
    const templateData = {
      event: eventData,
      otherInstances: eventData.series ? eventData.series.instances.slice(1, 6) : [],
      hasOtherInstances: eventData.series && eventData.series.instances.length > 1,
      calendarLinks: generateCalendarLinks(eventData)
    };

    // Render the page
    const html = template(templateData);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: html
    };

  } catch (error) {
    console.error('Error in get-event-details:', error);
    
    return {
      statusCode: 500,
      body: 'Internal server error. Please try again later.'
    };
  }
};

function generateCalendarLinks(eventData) {
  const { name, description, venue, date } = eventData;
  const eventDate = new Date(date);
  const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
  
  const googleLink = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(name)}&dates=${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(description)}&location=${encodeURIComponent(venue.name)}`;
  
  return {
    google: googleLink,
    ical: generateIcsDataURI(eventData)
  };
}

function generateIcsDataURI(eventData) {
  const { name, description, venue, date } = eventData;
  const eventDate = new Date(date);
  const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BrumOutloud//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@brumoutloud.co.uk`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${eventDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `SUMMARY:${name}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${venue.name}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  return `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;
}
```

## Phase 2: Frontend Improvements (Week 3-4)

### 2.1 Create Event Store

**Problem**: Frontend state management is scattered and doesn't persist.

**Solution**: Implement a centralized store with persistence.

```javascript
// js/event-store.js
class EventStore {
  constructor() {
    this.state = {
      events: [],
      filters: this.loadPersistedFilters(),
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: true
      },
      loading: false,
      error: null
    };
    
    this.subscribers = new Set();
    this.api = new EventAPI();
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Notify subscribers
  notify() {
    this.subscribers.forEach(callback => callback(this.state));
  }

  // Update state
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // Load events with error handling
  async loadEvents(filters = {}) {
    this.setState({ loading: true, error: null });
    
    try {
      const response = await this.api.getEvents(filters);
      
      this.setState({
        events: response.events,
        loading: false,
        pagination: {
          ...this.state.pagination,
          total: response.total,
          hasMore: response.events.length === filters.limit
        }
      });
      
    } catch (error) {
      console.error('Error loading events:', error);
      this.setState({
        loading: false,
        error: 'Failed to load events. Please try again.'
      });
    }
  }

  // Update filters with persistence
  updateFilters(newFilters) {
    const filters = { ...this.state.filters, ...newFilters };
    
    // Persist to localStorage
    this.persistFilters(filters);
    
    this.setState({ filters });
    this.loadEvents(filters);
  }

  // Persist filters to localStorage
  persistFilters(filters) {
    try {
      localStorage.setItem('eventFilters', JSON.stringify(filters));
    } catch (error) {
      console.error('Error persisting filters:', error);
    }
  }

  // Load persisted filters
  loadPersistedFilters() {
    try {
      const persisted = localStorage.getItem('eventFilters');
      return persisted ? JSON.parse(persisted) : this.getDefaultFilters();
    } catch (error) {
      console.error('Error loading persisted filters:', error);
      return this.getDefaultFilters();
    }
  }

  // Get default filters
  getDefaultFilters() {
    return {
      dateRange: { type: 'all' },
      categories: [],
      venues: [],
      search: '',
      sfwMode: true
    };
  }
}

// Event API wrapper
class EventAPI {
  constructor() {
    this.baseUrl = '/.netlify/functions';
  }

  async getEvents(filters = {}) {
    const params = new URLSearchParams();
    
    // Add filter parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
    });

    const response = await fetch(`${this.baseUrl}/get-events?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }
}
```

### 2.2 Update events.html

**Problem**: Current filtering logic is complex and tightly coupled.

**Solution**: Use the new store and simplify the logic.

```javascript
// Updated events.html script section
document.addEventListener('DOMContentLoaded', () => {
  const eventStore = new EventStore();
  const eventGrid = document.getElementById('event-grid');
  const filterBar = document.getElementById('filter-bar-container');
  
  // Subscribe to store changes
  eventStore.subscribe((state) => {
    renderEvents(state.events);
    updateLoadingState(state.loading);
    updateErrorState(state.error);
    updateFilterUI(state.filters);
  });

  // Initialize
  eventStore.loadEvents(eventStore.state.filters);

  // Filter event listeners
  filterBar.addEventListener('click', (e) => {
    const button = e.target.closest('.filter-button');
    if (!button) return;

    const filterType = button.dataset.filterType;
    const filterValue = button.dataset.filterValue;

    if (filterType === 'date') {
      eventStore.updateFilters({
        dateRange: { type: filterValue }
      });
    } else if (filterType === 'category') {
      eventStore.updateFilters({
        categories: filterValue === 'all' ? [] : [filterValue]
      });
    } else if (filterType === 'venue') {
      eventStore.updateFilters({
        venues: filterValue === 'all' ? [] : [filterValue]
      });
    }
  });

  // Custom date filter
  const dateFromInput = document.getElementById('date-from');
  const dateToInput = document.getElementById('date-to');
  
  [dateFromInput, dateToInput].forEach(input => {
    input.addEventListener('change', () => {
      eventStore.updateFilters({
        dateRange: {
          type: 'custom',
          from: dateFromInput.value,
          to: dateToInput.value
        }
      });
    });
  });

  // NSFW toggle
  const nsfwToggle = document.getElementById('nsfw-toggle');
  nsfwToggle.addEventListener('change', () => {
    eventStore.updateFilters({
      sfwMode: nsfwToggle.checked
    });
  });

  // Render functions
  function renderEvents(events) {
    if (events.length === 0) {
      eventGrid.innerHTML = `
        <div class="col-span-full text-center card-bg p-12">
          <div class="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-gray-800 text-accent-color">
            <i class="fas fa-search fa-2x"></i>
          </div>
          <h3 class="mt-4 text-xl font-semibold text-white">No Events Found</h3>
          <p class="mt-2 text-gray-400">Try adjusting your filters or search terms.</p>
        </div>
      `;
      return;
    }

    eventGrid.innerHTML = events.map(event => `
      <a href="/event/${event.slug}" class="item-card card-bg block group animate-fade-in">
        ${event.isBoosted ? '<div class="boosted-listing-tag">BOOSTED</div>' : ''}
        ${event.recurringInfo ? '<div class="recurring-event-tag">RECURRING</div>' : ''}
        <div class="item-card-image-container">
          <img src="${event.image || 'https://placehold.co/400x600/1e1e1e/EAEAEA?text=Event'}" 
               alt="${event.name}" class="item-card-image" loading="lazy">
        </div>
        <div class="p-6">
          <div class="mb-2 flex flex-wrap gap-2">
            ${event.category.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
          </div>
          <h3 class="font-bold text-xl text-white mb-2 group-hover:accent-color">
            ${event.name}
          </h3>
          <p class="text-gray-400 mb-1">
            ${new Date(event.date).toLocaleDateString('en-GB', { 
              day: 'numeric', 
              month: 'long', 
              hour: 'numeric', 
              minute: '2-digit' 
            })}
          </p>
          <p class="text-gray-400">${event.venue.name}</p>
          ${event.recurringInfo ? `<p class="text-sm text-purple-300 mt-1">${event.recurringInfo}</p>` : ''}
        </div>
      </a>
    `).join('');
  }

  function updateLoadingState(loading) {
    const loader = document.querySelector('.loader');
    if (loading) {
      loader.style.display = 'block';
    } else {
      loader.style.display = 'none';
    }
  }

  function updateErrorState(error) {
    if (error) {
      eventGrid.innerHTML = `
        <div class="col-span-full text-center card-bg p-12">
          <div class="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-800 text-white">
            <i class="fas fa-exclamation-triangle fa-2x"></i>
          </div>
          <h3 class="mt-4 text-xl font-semibold text-white">Error Loading Events</h3>
          <p class="mt-2 text-gray-400">${error}</p>
          <button onclick="location.reload()" class="mt-4 filter-button active">Retry</button>
        </div>
      `;
    }
  }

  function updateFilterUI(filters) {
    // Update filter button states
    document.querySelectorAll('.filter-button').forEach(button => {
      const filterType = button.dataset.filterType;
      const filterValue = button.dataset.filterValue;
      
      if (filterType === 'date' && filters.dateRange.type === filterValue) {
        button.classList.add('active');
      } else if (filterType === 'category' && filters.categories.includes(filterValue)) {
        button.classList.add('active');
      } else if (filterType === 'venue' && filters.venues.includes(filterValue)) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    // Update NSFW toggle
    const nsfwToggle = document.getElementById('nsfw-toggle');
    nsfwToggle.checked = filters.sfwMode;
  }
});
```

## Phase 3: Data Migration (Week 5-6)

### 3.1 Create Migration Script

**Problem**: Existing data needs to be cleaned and standardized.

**Solution**: Build a comprehensive migration script.

```javascript
// netlify/functions/migrate-event-data.js
const Airtable = require('airtable');
const SlugGenerator = require('./utils/slug-generator');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

const slugGenerator = new SlugGenerator();

exports.handler = async (event, context) => {
  try {
    console.log('Starting event data migration...');
    
    // Get all events
    const allRecords = await base('Events').select({
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 
        'Parent Event Name', 'Date', 'Status'
      ]
    }).all();

    console.log(`Found ${allRecords.length} events to process`);

    // Group events by series
    const seriesGroups = new Map();
    const standaloneEvents = [];

    allRecords.forEach(record => {
      const fields = record.fields;
      
      if (fields['Series ID'] || fields['Recurring Info']) {
        const seriesId = fields['Series ID'] || record.id;
        if (!seriesGroups.has(seriesId)) {
          seriesGroups.set(seriesId, []);
        }
        seriesGroups.get(seriesId).push(record);
      } else {
        standaloneEvents.push(record);
      }
    });

    console.log(`Found ${seriesGroups.size} series and ${standaloneEvents.length} standalone events`);

    // Process series events
    for (const [seriesId, events] of seriesGroups) {
      await processSeries(seriesId, events);
    }

    // Process standalone events
    for (const event of standaloneEvents) {
      await processStandaloneEvent(event);
    }

    console.log('Migration completed successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Migration completed',
        seriesProcessed: seriesGroups.size,
        standaloneProcessed: standaloneEvents.length
      })
    };

  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function processSeries(seriesId, events) {
  console.log(`Processing series ${seriesId} with ${events.length} events`);
  
  // Find parent event (has Recurring Info)
  const parentEvent = events.find(e => e.fields['Recurring Info']);
  if (!parentEvent) {
    console.warn(`No parent event found for series ${seriesId}`);
    return;
  }

  // Generate series slug
  const seriesSlug = await slugGenerator.ensureUniqueSlug(
    slugGenerator.generateSlug(parentEvent.fields['Event Name']),
    await getExistingSlugs()
  );

  // Update parent event
  await updateEvent(parentEvent.id, {
    'Slug': seriesSlug,
    'Series ID': seriesId
  });

  // Update child events
  for (const childEvent of events) {
    if (childEvent.id !== parentEvent.id) {
      await updateEvent(childEvent.id, {
        'Slug': seriesSlug,
        'Series ID': seriesId
      });
    }
  }
}

async function processStandaloneEvent(event) {
  const fields = event.fields;
  
  // Generate date-specific slug
  const eventSlug = await slugGenerator.ensureUniqueSlug(
    slugGenerator.generateSlug(fields['Event Name'], { 
      includeDate: true, 
      date: fields['Date'] 
    }),
    await getExistingSlugs()
  );

  // Update event
  await updateEvent(event.id, {
    'Slug': eventSlug
  });
}

async function updateEvent(recordId, updates) {
  try {
    await base('Events').update(recordId, updates);
    console.log(`Updated event ${recordId}`);
  } catch (error) {
    console.error(`Failed to update event ${recordId}:`, error);
  }
}

async function getExistingSlugs() {
  const records = await base('Events').select({
    fields: ['Slug']
  }).all();
  
  return records.map(r => r.fields['Slug']).filter(Boolean);
}
```

## Phase 4: Testing & Deployment (Week 7-8)

### 4.1 Create Test Suite

```javascript
// tests/event-service.test.js
const EventService = require('../netlify/functions/services/event-service');

describe('EventService', () => {
  let eventService;

  beforeEach(() => {
    eventService = new EventService();
  });

  describe('getEventBySlug', () => {
    it('should find event by exact slug match', async () => {
      const event = await eventService.getEventBySlug('test-event');
      expect(event).toBeDefined();
      expect(event.slug).toBe('test-event');
    });

    it('should handle series events correctly', async () => {
      const event = await eventService.getEventBySlug('recurring-event');
      expect(event.series).toBeDefined();
      expect(event.series.type).toBe('recurring');
    });

    it('should return null for non-existent events', async () => {
      const event = await eventService.getEventBySlug('non-existent-event');
      expect(event).toBeNull();
    });
  });

  describe('searchEventByName', () => {
    it('should find events by partial name match', async () => {
      const event = await eventService.searchEventByName('test');
      expect(event).toBeDefined();
      expect(event.name).toContain('test');
    });
  });
});
```

### 4.2 Deployment Checklist

- [ ] Deploy new functions to staging
- [ ] Run migration script on staging data
- [ ] Test all functionality on staging
- [ ] Update production environment variables
- [ ] Deploy to production
- [ ] Run migration script on production
- [ ] Monitor for errors
- [ ] Update documentation

## Benefits of This Implementation

1. **Resilience**: Multiple fallback strategies for finding events
2. **Performance**: Caching reduces database queries
3. **Maintainability**: Clear separation of concerns
4. **User Experience**: Persistent filters and better error handling
5. **Scalability**: Modular design allows easy extension

This implementation addresses all the current vulnerabilities while providing a solid foundation for future development.