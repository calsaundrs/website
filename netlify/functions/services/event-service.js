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
        'Status',
        'Promo Image', 'Cloudinary Public ID', 'Featured Banner Start Date',
        'Featured Banner End Date', 'Boosted Listing Start Date',
        'Boosted Listing End Date'
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
        'Venue', 'Venue Name', 'VenueText', 'Category', 'Description',
        'Status'
      ]
    }).firstPage();

    if (records.length === 0) return null;

    // Return the most relevant match
    return this.processStandaloneEvent(records[0]);
  }

  async getEvents(filters = {}, options = {}) {
    const {
      dateRange,
      categories = [],
      venues = [],
      search = '',
      sfwMode = true,
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
      const records = await this.base('Events').select(query).all();
      
      // Process events
      events = await this.processEventRecords(records);
      
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

  buildEventQuery(filters) {
    const { dateRange, categories, venues, search, sfwMode } = filters;
    
    // Start with a simple filter - just approved events
    let filterFormula = "{Status} = 'Approved'";
    
    console.log('Generated filter formula:', filterFormula);
    
    return {
      filterByFormula: filterFormula,
      sort: [{ field: 'Date', direction: 'asc' }],
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date',
        'Venue', 'Venue Name', 'VenueText', 'Category', 'Description',
        'Promo Image', 'Cloudinary Public ID', 'Featured Banner Start Date',
        'Featured Banner End Date', 'Boosted Listing Start Date',
        'Boosted Listing End Date', 'Status'
      ]
    };
  }

  async processEventRecords(records) {
    const events = [];
    const seriesGroups = new Map();
    const standaloneEvents = [];

    // Group events by series
    records.forEach(record => {
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

    // Process standalone events
    standaloneEvents.forEach(record => {
      events.push(this.processStandaloneEvent(record));
    });

    // Process series events (limit instances per series)
    const instancesToShow = parseInt(process.env.RECURRING_INSTANCES_TO_SHOW) || 6;
    
    for (const [seriesId, seriesRecords] of seriesGroups) {
      const parentEvent = seriesRecords.find(r => r.fields['Recurring Info']);
      if (parentEvent) {
        const seriesInstances = seriesRecords
          .sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date))
          .slice(0, instancesToShow);
        
        seriesInstances.forEach(record => {
          events.push(this.processSeriesInstance(record, seriesId, seriesRecords.length));
        });
      }
    }

    return events;
  }

  processSeriesEvent(parentRecord, allRecords) {
    const fields = parentRecord.fields;
    const seriesId = parentRecord.id;
    
    // Get all future instances
    const futureInstances = allRecords
      .filter(record => new Date(record.fields.Date) > new Date())
      .sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));

    // Use the next instance date as the main date for the series
    const nextInstanceDate = futureInstances[0] ? futureInstances[0].fields.Date : fields['Date'];

    return {
      id: parentRecord.id,
      name: fields['Event Name'],
      slug: fields['Slug'],
      description: fields['Description'],
      date: nextInstanceDate, // Add the date field
      recurringInfo: fields['Recurring Info'],
      category: fields['Category'] || [],
      venue: this.extractVenueInfo(fields),
      image: this.extractImageInfo(fields),
      promotion: this.extractPromotionInfo(fields),
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

  processSeriesInstance(record, seriesId, totalInstances) {
    const fields = record.fields;
    
    return {
      id: record.id,
      name: fields['Event Name'],
      slug: fields['Slug'],
      description: fields['Description'],
      date: fields['Date'],
      category: fields['Category'] || [],
      venue: this.extractVenueInfo(fields),
      image: this.extractImageInfo(fields),
      promotion: this.extractPromotionInfo(fields),
      recurringInfo: fields['Recurring Info'],
      series: {
        id: seriesId,
        type: 'recurring',
        totalInstances: totalInstances
      }
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
      image: this.extractImageInfo(fields),
      promotion: this.extractPromotionInfo(fields),
      details: {
        price: fields['Price'] || null,
        ageRestriction: fields['Age Restriction'] || null,
        link: fields['Link'] || null
      }
    };
  }

  extractVenueInfo(fields) {
    const venueName = fields['Venue Name'] ? 
      fields['Venue Name'][0] : 
      fields['VenueText'] || 'TBC';
    
    return {
      name: venueName
    };
  }

  extractImageInfo(fields) {
    const cloudinaryId = fields['Cloudinary Public ID'];
    const promoImage = fields['Promo Image'] && fields['Promo Image'][0];
    
    if (cloudinaryId) {
      return {
        url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_500,h_281,c_limit/${cloudinaryId}`,
        alt: fields['Event Name']
      };
    } else if (promoImage) {
      return {
        url: promoImage.url,
        alt: fields['Event Name']
      };
    }
    
    return null;
  }

  extractPromotionInfo(fields) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let isFeatured = false;
    let isBoosted = false;

    const featuredStartDate = fields['Featured Banner Start Date'] ? new Date(fields['Featured Banner Start Date']) : null;
    const featuredEndDate = fields['Featured Banner End Date'] ? new Date(fields['Featured Banner End Date']) : null;
    if (featuredStartDate && featuredEndDate && today >= featuredStartDate && today <= new Date(featuredEndDate.getTime() + 86400000)) {
      isFeatured = true;
    }

    const boostedStartDate = fields['Boosted Listing Start Date'] ? new Date(fields['Boosted Listing Start Date']) : null;
    const boostedEndDate = fields['Boosted Listing End Date'] ? new Date(fields['Boosted Listing End Date']) : null;
    if (boostedStartDate && boostedEndDate && today >= boostedStartDate && today <= new Date(boostedEndDate.getTime() + 86400000)) {
      isBoosted = true;
    }

    return {
      featured: isFeatured,
      boosted: isBoosted
    };
  }

  applyPostQueryFilters(events, filters) {
    const { dateRange, categories, venues, search, sfwMode } = filters;
    
    return events.filter(event => {
      // Date filtering
      if (dateRange && dateRange.type !== 'all') {
        const eventDate = new Date(event.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        switch (dateRange.type) {
          case 'today':
            const eventDay = new Date(eventDate);
            eventDay.setHours(0, 0, 0, 0);
            if (eventDay.getTime() !== today.getTime()) return false;
            break;
          case 'this-weekend':
            const dayOfWeek = today.getDay();
            const friday = new Date(today);
            friday.setDate(today.getDate() - dayOfWeek + 5);
            const sunday = new Date(friday);
            sunday.setDate(friday.getDate() + 2);
            if (eventDate < friday || eventDate > sunday) return false;
            break;
          case 'custom':
            if (dateRange.from && eventDate < new Date(dateRange.from)) return false;
            if (dateRange.to && eventDate > new Date(dateRange.to)) return false;
            break;
          default:
            if (eventDate < today) return false;
        }
      } else {
        // Default: only future events
        if (new Date(event.date) < new Date()) return false;
      }
      
      // Category filtering
      if (categories && categories.length > 0) {
        const eventCategories = event.category || [];
        if (!categories.some(cat => eventCategories.includes(cat))) return false;
      }
      
      // Venue filtering
      if (venues && venues.length > 0) {
        const eventVenue = event.venue ? event.venue.name : '';
        if (!venues.includes(eventVenue)) return false;
      }
      
      // Search filtering
      if (search) {
        const searchLower = search.toLowerCase();
        const eventName = event.name.toLowerCase();
        const eventDescription = (event.description || '').toLowerCase();
        const eventVenue = event.venue ? event.venue.name.toLowerCase() : '';
        
        if (!eventName.includes(searchLower) && 
            !eventDescription.includes(searchLower) && 
            !eventVenue.includes(searchLower)) {
          return false;
        }
      }
      
      // SFW mode filtering
      if (sfwMode) {
        const eventCategories = event.category || [];
        if (eventCategories.includes('Kink')) return false;
      }
      
      return true;
    });
  }



  sortAndPaginate(events, sortBy, sortOrder, limit, offset) {
    // Sort events
    events.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'venue':
          aValue = a.venue.name.toLowerCase();
          bValue = b.venue.name.toLowerCase();
          break;
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });
    
    // Paginate
    return events.slice(offset, offset + limit);
  }

  generateCacheKey(filters, options) {
    return `events:${JSON.stringify(filters)}:${JSON.stringify(options)}`;
  }

  clearCache() {
    this.cache.clear();
  }

  clearEventCache(eventId) {
    for (const [key] of this.cache) {
      if (key.includes(`event:${eventId}`)) {
        this.cache.delete(key);
      }
    }
  }

  async getVenues() {
    const cacheKey = 'venues';
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Get all events to extract unique venues
      const records = await this.base('Events').select({
        filterByFormula: "{Status} = 'Approved'",
        fields: ['Venue Name', 'VenueText']
      }).all();

      const venueMap = new Map();
      
      records.forEach(record => {
        const venueName = record.fields['Venue Name'] ? 
          record.fields['Venue Name'][0] : 
          record.fields['VenueText'];
        
        if (venueName && !venueMap.has(venueName)) {
          venueMap.set(venueName, {
            id: venueName,
            name: venueName
          });
        }
      });

      const venues = Array.from(venueMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      // Cache the result
      this.cache.set(cacheKey, {
        data: venues,
        timestamp: Date.now()
      });

      return venues;

    } catch (error) {
      console.error('Error fetching venues:', error);
      return [];
    }
  }
}

module.exports = EventService;