const Airtable = require('airtable');
const EventService = require('./event-service');

class SeriesManager {
  constructor() {
    this.base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);
    this.eventService = new EventService();
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  async createSeries(seriesData) {
    const { name, pattern, recurrence, description, venue, category } = seriesData;
    
    if (!name || !pattern) {
      throw new Error('Series name and pattern are required');
    }

    try {
      // Create parent event for the series
      const parentEvent = await this.base('Events').create({
        'Event Name': name,
        'Description': description || '',
        'Recurring Info': pattern,
        'VenueText': venue || 'TBC',
        'Category': category || [],
        'Status': 'Approved',
        'Date': new Date().toISOString().split('T')[0] // Today's date as placeholder
      });

      const seriesId = parentEvent.id;
      
      // Generate proper slug for the series
      const slug = await this.generateSeriesSlug(name, seriesId);
      
      // Update parent event with proper slug and series ID
      await this.base('Events').update(seriesId, {
        'Slug': slug,
        'Series ID': seriesId
      });

      const series = {
        id: seriesId,
        name: name,
        pattern: pattern,
        recurrence: recurrence,
        slug: slug,
        events: [seriesId],
        createdAt: new Date()
      };

      // Cache the series
      this.cache.set(seriesId, {
        data: series,
        timestamp: Date.now()
      });

      return series;

    } catch (error) {
      console.error('Error creating series:', error);
      throw new Error('Failed to create series');
    }
  }

  async addEventToSeries(eventId, seriesId) {
    try {
      const series = await this.getSeries(seriesId);
      const event = await this.eventService.getEventBySlug(eventId);
      
      if (!series || !event) {
        throw new Error('Series or event not found');
      }
      
      // Update the event to be part of the series
      await this.base('Events').update(eventId, {
        'Series ID': seriesId,
        'Slug': series.slug
      });
      
      // Add to series events list
      series.events.push(eventId);
      await this.saveSeries(series);
      
      // Clear related caches
      this.clearSeriesCache(seriesId);
      this.eventService.clearEventCache(eventId);
      
      return series;
      
    } catch (error) {
      console.error('Error adding event to series:', error);
      throw new Error('Failed to add event to series');
    }
  }

  async generateInstances(seriesId, count = 12) {
    try {
      const series = await this.getSeries(seriesId);
      const parentEvent = await this.base('Events').find(series.events[0]);
      
      if (!parentEvent) {
        throw new Error('Parent event not found');
      }

      const instances = this.calculateRecurrenceDates(
        parentEvent.fields.Date,
        series.recurrence || series.pattern,
        count
      );
      
      const newEvents = [];
      
      for (const date of instances) {
        const newEvent = await this.createSeriesInstance(parentEvent, date, seriesId);
        newEvents.push(newEvent);
      }
      
      // Update series with new events
      series.events.push(...newEvents.map(e => e.id));
      await this.saveSeries(series);
      
      // Clear caches
      this.clearSeriesCache(seriesId);
      
      return newEvents;
      
    } catch (error) {
      console.error('Error generating instances:', error);
      throw new Error('Failed to generate series instances');
    }
  }

  async getSeriesWithInstances(seriesId, options = {}) {
    const { limit, futureOnly = true, includeCancelled = false } = options;
    
    try {
      const series = await this.getSeries(seriesId);
      if (!series) {
        throw new Error('Series not found');
      }
      
      // Get all events in the series
      const eventRecords = await this.base('Events').select({
        filterByFormula: `{Series ID} = "${seriesId}"`,
        fields: [
          'Event Name', 'Date', 'VenueText', 'Venue Name', 'Status',
          'Description', 'Category', 'Promo Image'
        ]
      }).all();
      
      let events = eventRecords.map(record => ({
        id: record.id,
        name: record.fields['Event Name'],
        date: record.fields['Date'],
        venue: record.fields['Venue Name'] ? 
          record.fields['Venue Name'][0] : 
          record.fields['VenueText'] || 'TBC',
        status: record.fields['Status'],
        description: record.fields['Description'],
        category: record.fields['Category'] || [],
        image: record.fields['Promo Image'] ? record.fields['Promo Image'][0].url : null
      }));
      
      // Filter by date if requested
      if (futureOnly) {
        events = events.filter(e => new Date(e.date) > new Date());
      }
      
      // Filter by status if requested
      if (!includeCancelled) {
        events = events.filter(e => e.status !== 'cancelled');
      }
      
      // Sort by date
      events.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Apply limit
      if (limit) {
        events = events.slice(0, limit);
      }
      
      return {
        ...series,
        events: events
      };
      
    } catch (error) {
      console.error('Error getting series with instances:', error);
      throw new Error('Failed to get series instances');
    }
  }

  async updateSeriesEvent(eventId, updates) {
    try {
      // Update the event
      await this.base('Events').update(eventId, updates);
      
      // Get the series ID from the event
      const event = await this.base('Events').find(eventId);
      const seriesId = event.fields['Series ID'];
      
      if (seriesId) {
        // Clear series cache
        this.clearSeriesCache(seriesId);
      }
      
      // Clear event cache
      this.eventService.clearEventCache(eventId);
      
    } catch (error) {
      console.error('Error updating series event:', error);
      throw new Error('Failed to update series event');
    }
  }

  async getSeries(seriesId) {
    const cacheKey = `series:${seriesId}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Get parent event (has Recurring Info)
      const records = await this.base('Events').select({
        filterByFormula: `AND({Series ID} = "${seriesId}", {Recurring Info})`,
        maxRecords: 1,
        fields: [
          'Event Name', 'Recurring Info', 'Series ID', 'Slug', 'Description',
          'VenueText', 'Venue Name', 'Category'
        ]
      }).firstPage();

      if (records.length === 0) {
        return null;
      }

      const parentEvent = records[0];
      const series = {
        id: seriesId,
        name: parentEvent.fields['Event Name'],
        pattern: parentEvent.fields['Recurring Info'],
        slug: parentEvent.fields['Slug'],
        description: parentEvent.fields['Description'],
        venue: parentEvent.fields['Venue Name'] ? 
          parentEvent.fields['Venue Name'][0] : 
          parentEvent.fields['VenueText'] || 'TBC',
        category: parentEvent.fields['Category'] || [],
        events: [parentEvent.id],
        createdAt: new Date()
      };

      // Cache the series
      this.cache.set(cacheKey, {
        data: series,
        timestamp: Date.now()
      });

      return series;

    } catch (error) {
      console.error('Error getting series:', error);
      return null;
    }
  }

  async getSeriesBySlug(slug) {
    try {
      const records = await this.base('Events').select({
        filterByFormula: `AND({Slug} = "${slug}", {Recurring Info})`,
        maxRecords: 1,
        fields: ['Series ID']
      }).firstPage();

      if (records.length === 0) {
        return null;
      }

      const seriesId = records[0].fields['Series ID'];
      return await this.getSeries(seriesId);

    } catch (error) {
      console.error('Error getting series by slug:', error);
      return null;
    }
  }

  calculateRecurrenceDates(startDate, pattern, count) {
    const dates = [];
    const start = new Date(startDate);
    
    // Simple pattern parsing (can be enhanced for more complex patterns)
    const patternLower = pattern.toLowerCase();
    
    if (patternLower.includes('weekly') || patternLower.includes('every week')) {
      for (let i = 1; i <= count; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + (i * 7));
        dates.push(date.toISOString().split('T')[0]);
      }
    } else if (patternLower.includes('monthly') || patternLower.includes('every month')) {
      for (let i = 1; i <= count; i++) {
        const date = new Date(start);
        date.setMonth(start.getMonth() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
    } else if (patternLower.includes('daily') || patternLower.includes('every day')) {
      for (let i = 1; i <= count; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
      }
    } else {
      // Default to weekly if pattern is not recognized
      for (let i = 1; i <= count; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + (i * 7));
        dates.push(date.toISOString().split('T')[0]);
      }
    }
    
    return dates;
  }

  async createSeriesInstance(parentEvent, date, seriesId) {
    try {
      const newEvent = await this.base('Events').create({
        'Event Name': parentEvent.fields['Event Name'],
        'Description': parentEvent.fields['Description'],
        'Date': date,
        'VenueText': parentEvent.fields['VenueText'],
        'Venue Name': parentEvent.fields['Venue Name'],
        'Category': parentEvent.fields['Category'],
        'Series ID': seriesId,
        'Slug': parentEvent.fields['Slug'],
        'Status': 'Approved'
      });

      return newEvent;

    } catch (error) {
      console.error('Error creating series instance:', error);
      throw new Error('Failed to create series instance');
    }
  }

  async generateSeriesSlug(name, seriesId) {
    const { SlugGenerator } = require('../utils/slug-generator');
    const slugGenerator = new SlugGenerator();
    
    const baseSlug = slugGenerator.generateSlug(name, { seriesId });
    
    // Get existing slugs to ensure uniqueness
    const existingSlugs = await this.getExistingSlugs();
    
    return await slugGenerator.ensureUniqueSlug(baseSlug, existingSlugs);
  }

  async getExistingSlugs() {
    try {
      const records = await this.base('Events').select({
        fields: ['Slug']
      }).all();
      
      return records.map(r => r.fields['Slug']).filter(Boolean);
    } catch (error) {
      console.error('Error getting existing slugs:', error);
      return [];
    }
  }

  async saveSeries(series) {
    // This would typically save to a separate series table
    // For now, we'll just update the cache
    const cacheKey = `series:${series.id}`;
    this.cache.set(cacheKey, {
      data: series,
      timestamp: Date.now()
    });
  }

  clearSeriesCache(seriesId) {
    const cacheKey = `series:${seriesId}`;
    this.cache.delete(cacheKey);
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = SeriesManager;