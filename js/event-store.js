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
          total: response.total || response.events.length,
          hasMore: response.events.length === (filters.limit || 20)
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
      dateRange: { type: 'upcoming' },
      categories: [],
      venues: [],
      search: '',
      sfwMode: true
    };
  }

  // Clear all filters
  clearFilters() {
    const defaultFilters = this.getDefaultFilters();
    this.updateFilters(defaultFilters);
  }

  // Get current state
  getState() {
    return this.state;
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
        } else if (typeof value === 'object') {
          params.append(key, JSON.stringify(value));
        } else {
          params.append(key, value);
        }
      }
    });

    console.log('EventAPI: Sending filters to API:', filters);
    console.log('EventAPI: URL params:', params.toString());

    console.log('EventAPI: Calling get-events-firestore-simple with params:', params.toString());
    const response = await fetch(`${this.baseUrl}/get-events-firestore-simple?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('EventAPI: Received data from API:', data);
    console.log('EventAPI: Number of events:', data.events ? data.events.length : 0);
    
    // Log the first event to see its structure
    if (data.events && data.events.length > 0) {
      console.log('EventAPI: First event structure:', data.events[0]);
      console.log('EventAPI: First event image field:', data.events[0].image);
    }
    
    return data;
  }

  async getVenues() {
            const response = await fetch(`${this.baseUrl}/get-events-firestore-simple?view=venues`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.venues || [];
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EventStore, EventAPI };
}