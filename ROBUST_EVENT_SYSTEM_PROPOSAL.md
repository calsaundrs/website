# Robust Event Series Management System Proposal

## Executive Summary

The current event series management system is fragile and breaks frequently due to complex relationships between multiple data fields, inconsistent slug generation, and tight coupling between frontend and backend logic. This proposal outlines a comprehensive solution that separates concerns, implements proper data modeling, and provides resilience against common failure modes.

## Current System Problems

### 1. Data Model Issues
- **Multiple Series Fields**: Uses `Series ID`, `Recurring Info`, and `Parent Event Name` inconsistently
- **Slug Generation Complexity**: Different logic for recurring vs standalone events
- **Orphaned Relationships**: Child events can exist without proper parent links
- **No Validation**: No constraints ensure data integrity

### 2. Frontend Vulnerabilities
- **Hard-coded Limits**: `RECURRING_INSTANCES_TO_SHOW` limits flexibility
- **Complex Filtering**: Date, category, and venue filters are tightly coupled
- **No State Persistence**: Filter states don't persist across sessions
- **Performance Issues**: No caching or pagination

### 3. Backend Fragility
- **Multiple Query Paths**: Events found through various inconsistent methods
- **No Error Recovery**: System breaks when expected data is missing
- **Direct Airtable Dependencies**: No abstraction layer for data access

## Proposed Solution Architecture

### 1. Unified Event Data Model

```javascript
// Core Event Schema
const EventSchema = {
  // Primary Fields
  id: String,                    // Unique identifier
  name: String,                  // Event name
  slug: String,                  // URL-friendly identifier (unique)
  description: String,
  date: Date,
  
  // Venue Information
  venue: {
    id: String,
    name: String,
    slug: String,
    address: String,
    coordinates: { lat: Number, lng: Number }
  },
  
  // Categorization
  category: [String],
  tags: [String],
  
  // Media
  image: {
    url: String,
    alt: String,
    cloudinaryId: String
  },
  
  // Status Management
  status: 'draft' | 'published' | 'archived' | 'cancelled',
  publishedAt: Date,
  archivedAt: Date,
  
  // Series Management (NEW)
  series: {
    id: String,                  // Unique series identifier
    type: 'single' | 'recurring' | 'series',
    pattern: String,             // "weekly", "monthly", "custom"
    recurrence: Object,          // RRULE or custom pattern
    parentId: String,            // For child events
    instances: [String],         // Array of event IDs in series
    totalInstances: Number,
    nextInstance: Date
  },
  
  // Promotion & Visibility
  promotion: {
    featured: Boolean,
    boosted: Boolean,
    featuredStart: Date,
    featuredEnd: Date,
    boostedStart: Date,
    boostedEnd: Date,
    priority: Number             // For sorting when multiple promotions
  },
  
  // Additional Details
  details: {
    price: String,
    ageRestriction: String,
    ticketLink: String,
    contactInfo: Object
  },
  
  // Metadata
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    createdBy: String,
    lastModifiedBy: String,
    version: Number
  }
}
```

### 2. Series Management System

```javascript
// Series Management Service
class SeriesManager {
  constructor() {
    this.cache = new Map();
    this.eventService = new EventService();
  }

  // Create a new series
  async createSeries(seriesData) {
    const seriesId = this.generateSeriesId();
    const series = {
      id: seriesId,
      name: seriesData.name,
      pattern: seriesData.pattern,
      recurrence: seriesData.recurrence,
      events: [],
      createdAt: new Date()
    };
    
    await this.saveSeries(series);
    return series;
  }

  // Add event to series
  async addEventToSeries(eventId, seriesId) {
    const series = await this.getSeries(seriesId);
    const event = await this.eventService.getEvent(eventId);
    
    if (!series || !event) {
      throw new Error('Series or event not found');
    }
    
    series.events.push(eventId);
    event.series.id = seriesId;
    event.series.parentId = series.events[0]; // First event is parent
    
    await Promise.all([
      this.saveSeries(series),
      this.eventService.updateEvent(eventId, event)
    ]);
    
    return series;
  }

  // Generate future instances
  async generateInstances(seriesId, count = 12) {
    const series = await this.getSeries(seriesId);
    const parentEvent = await this.eventService.getEvent(series.events[0]);
    
    const instances = this.calculateRecurrenceDates(
      parentEvent.date,
      series.recurrence,
      count
    );
    
    const newEvents = await Promise.all(
      instances.map(date => this.createSeriesInstance(parentEvent, date))
    );
    
    series.events.push(...newEvents.map(e => e.id));
    await this.saveSeries(series);
    
    return newEvents;
  }

  // Get series with instances
  async getSeriesWithInstances(seriesId, options = {}) {
    const series = await this.getSeries(seriesId);
    const { limit, futureOnly = true, includeCancelled = false } = options;
    
    let events = await Promise.all(
      series.events.map(id => this.eventService.getEvent(id))
    );
    
    if (futureOnly) {
      events = events.filter(e => new Date(e.date) > new Date());
    }
    
    if (!includeCancelled) {
      events = events.filter(e => e.status !== 'cancelled');
    }
    
    if (limit) {
      events = events.slice(0, limit);
    }
    
    return {
      ...series,
      events: events.sort((a, b) => new Date(a.date) - new Date(b.date))
    };
  }
}
```

### 3. Robust Event Service

```javascript
// Event Service with Caching and Error Handling
class EventService {
  constructor() {
    this.cache = new LRUCache(1000);
    this.airtable = new AirtableService();
    this.slugGenerator = new SlugGenerator();
  }

  // Get event by slug with fallback strategies
  async getEventBySlug(slug, options = {}) {
    const cacheKey = `event:${slug}`;
    
    // Try cache first
    let event = this.cache.get(cacheKey);
    if (event) return event;
    
    try {
      // Primary lookup by slug
      event = await this.airtable.findEventBySlug(slug);
      
      if (!event) {
        // Fallback: Check if it's a series slug
        const series = await this.seriesManager.getSeriesBySlug(slug);
        if (series) {
          event = await this.seriesManager.getSeriesWithInstances(series.id, {
            limit: 1,
            futureOnly: true
          });
        }
      }
      
      if (!event) {
        // Final fallback: Search by name similarity
        event = await this.searchEventByName(slug);
      }
      
      if (event) {
        this.cache.set(cacheKey, event);
        return event;
      }
      
      throw new Error('Event not found');
      
    } catch (error) {
      console.error('Error fetching event by slug:', error);
      throw new Error('Failed to load event');
    }
  }

  // Get events with robust filtering
  async getEvents(filters = {}, options = {}) {
    const {
      dateRange,
      categories,
      venues,
      series,
      status = 'published',
      limit = 50,
      offset = 0,
      sortBy = 'date',
      sortOrder = 'asc'
    } = filters;

    const cacheKey = this.generateCacheKey(filters, options);
    let events = this.cache.get(cacheKey);
    
    if (events) return events;

    try {
      // Build query with proper error handling
      const query = this.buildEventQuery(filters);
      events = await this.airtable.queryEvents(query);
      
      // Apply post-query filtering
      events = this.applyPostQueryFilters(events, filters);
      
      // Sort and paginate
      events = this.sortAndPaginate(events, sortBy, sortOrder, limit, offset);
      
      this.cache.set(cacheKey, events);
      return events;
      
    } catch (error) {
      console.error('Error fetching events:', error);
      // Return cached data if available, otherwise empty array
      return this.cache.get('fallback:events') || [];
    }
  }

  // Update event with validation
  async updateEvent(eventId, updates) {
    try {
      // Validate updates
      const validatedUpdates = await this.validateEventUpdates(eventId, updates);
      
      // Update event
      const updatedEvent = await this.airtable.updateEvent(eventId, validatedUpdates);
      
      // Clear related caches
      this.clearEventCaches(eventId);
      
      // If series event, update series
      if (updatedEvent.series.id) {
        await this.seriesManager.updateSeriesEvent(updatedEvent);
      }
      
      return updatedEvent;
      
    } catch (error) {
      console.error('Error updating event:', error);
      throw new Error('Failed to update event');
    }
  }
}
```

### 4. Frontend State Management

```javascript
// Event Store with Redux-like state management
class EventStore {
  constructor() {
    this.state = {
      events: [],
      series: new Map(),
      filters: {
        dateRange: null,
        categories: [],
        venues: [],
        search: '',
        sfwMode: true
      },
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
    this.eventService = new EventService();
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
      const events = await this.eventService.getEvents(filters);
      
      this.setState({
        events,
        loading: false,
        pagination: {
          ...this.state.pagination,
          total: events.length,
          hasMore: events.length === filters.limit
        }
      });
      
    } catch (error) {
      this.setState({
        loading: false,
        error: error.message
      });
    }
  }

  // Update filters with persistence
  updateFilters(newFilters) {
    const filters = { ...this.state.filters, ...newFilters };
    
    // Persist to localStorage
    localStorage.setItem('eventFilters', JSON.stringify(filters));
    
    this.setState({ filters });
    this.loadEvents(filters);
  }

  // Load persisted filters
  loadPersistedFilters() {
    try {
      const persisted = localStorage.getItem('eventFilters');
      if (persisted) {
        const filters = JSON.parse(persisted);
        this.setState({ filters });
        return filters;
      }
    } catch (error) {
      console.error('Error loading persisted filters:', error);
    }
    return null;
  }
}
```

### 5. Robust Filtering System

```javascript
// Filter Manager with validation and optimization
class FilterManager {
  constructor() {
    this.validators = new Map();
    this.optimizers = new Map();
    this.setupValidators();
  }

  setupValidators() {
    // Date range validator
    this.validators.set('dateRange', (range) => {
      if (!range) return true;
      
      const { from, to } = range;
      if (from && to && new Date(from) > new Date(to)) {
        throw new Error('Start date must be before end date');
      }
      
      return true;
    });

    // Category validator
    this.validators.set('categories', (categories) => {
      if (!Array.isArray(categories)) {
        throw new Error('Categories must be an array');
      }
      
      const validCategories = ['Club Night', 'Social', 'Cultural', 'Kink', 'Pride'];
      const invalid = categories.filter(cat => !validCategories.includes(cat));
      
      if (invalid.length > 0) {
        throw new Error(`Invalid categories: ${invalid.join(', ')}`);
      }
      
      return true;
    });
  }

  // Validate and optimize filters
  processFilters(filters) {
    const processed = {};
    
    for (const [key, value] of Object.entries(filters)) {
      // Validate
      const validator = this.validators.get(key);
      if (validator) {
        validator(value);
      }
      
      // Optimize
      const optimizer = this.optimizers.get(key);
      if (optimizer) {
        processed[key] = optimizer(value);
      } else {
        processed[key] = value;
      }
    }
    
    return processed;
  }

  // Build efficient query
  buildQuery(filters) {
    const processed = this.processFilters(filters);
    const query = {};
    
    // Date filtering
    if (processed.dateRange) {
      query.dateFilter = this.buildDateFilter(processed.dateRange);
    }
    
    // Category filtering
    if (processed.categories && processed.categories.length > 0) {
      query.categoryFilter = this.buildCategoryFilter(processed.categories);
    }
    
    // Venue filtering
    if (processed.venues && processed.venues.length > 0) {
      query.venueFilter = this.buildVenueFilter(processed.venues);
    }
    
    return query;
  }
}
```

## Implementation Strategy

### Phase 1: Data Model Migration
1. Create new Airtable schema with unified fields
2. Build migration scripts to transform existing data
3. Implement data validation and integrity checks
4. Create backup and rollback procedures

### Phase 2: Backend Services
1. Implement SeriesManager service
2. Build robust EventService with caching
3. Create FilterManager for efficient queries
4. Add comprehensive error handling and logging

### Phase 3: Frontend Refactoring
1. Implement EventStore for state management
2. Build reusable filter components
3. Add proper loading states and error handling
4. Implement progressive enhancement

### Phase 4: Testing & Optimization
1. Comprehensive unit and integration tests
2. Performance testing and optimization
3. User acceptance testing
4. Gradual rollout with feature flags

## Benefits of New System

### 1. Resilience
- **Graceful Degradation**: System continues working even when parts fail
- **Error Recovery**: Automatic retry and fallback mechanisms
- **Data Validation**: Prevents invalid data from breaking the system

### 2. Performance
- **Intelligent Caching**: Reduces database queries and improves response times
- **Efficient Queries**: Optimized filtering and pagination
- **Progressive Loading**: Better user experience with loading states

### 3. Maintainability
- **Separation of Concerns**: Clear boundaries between services
- **Testable Code**: Comprehensive test coverage
- **Documentation**: Clear APIs and usage examples

### 4. Scalability
- **Modular Architecture**: Easy to add new features
- **Configurable Limits**: Flexible pagination and filtering
- **Future-Proof Design**: Ready for additional event types and features

## Risk Mitigation

### 1. Data Migration Risks
- **Comprehensive Backups**: Multiple backup points before migration
- **Rollback Plan**: Ability to revert to old system if needed
- **Gradual Migration**: Migrate data in phases to minimize risk

### 2. Performance Risks
- **Load Testing**: Test system under expected load
- **Monitoring**: Real-time performance monitoring
- **Optimization**: Continuous performance improvements

### 3. User Experience Risks
- **Feature Flags**: Gradual rollout of new features
- **User Testing**: Validate changes with real users
- **Fallback Options**: Keep old system available during transition

This robust approach will eliminate the current vulnerabilities and provide a solid foundation for future growth and feature development.