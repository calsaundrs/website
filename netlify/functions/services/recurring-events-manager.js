const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Version: 2025-01-27-v1 - Comprehensive Recurring Events Manager
class RecurringEventsManager {
  constructor() {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    
    this.db = admin.firestore();
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Create a new recurring event series
   */
  async createRecurringSeries(seriesData) {
    const {
      name,
      description,
      category,
      venueSlug,
      venueName,
      recurringPattern,
      startDate,
      endDate,
      maxInstances = 52,
      time = '20:00',
      image,
      link,
      price,
      ageRestriction
    } = seriesData;

    if (!name || !recurringPattern || !startDate) {
      throw new Error('Missing required fields: name, recurringPattern, startDate');
    }

    try {
      // Generate unique group ID
      const recurringGroupId = uuidv4();
      
      // Generate base slug
      const baseSlug = this.generateSlug(name);
      
      // Calculate all instances
      const instances = this.calculateRecurringInstances({
        startDate,
        endDate,
        pattern: recurringPattern,
        maxInstances,
        time
      });

      // Create all instances in a batch
      const batch = this.db.batch();
      const createdEvents = [];

      instances.forEach((instanceDate, index) => {
        const eventRef = this.db.collection('events').doc();
        const instanceSlug = `${baseSlug}-${index + 1}`;
        
        const eventData = {
          name,
          description,
          category: category || [],
          date: instanceDate.toISOString(),
          slug: instanceSlug,
          venueSlug,
          venueName,
          image,
          link,
          price,
          ageRestriction,
          status: 'approved',
          
          // Recurring event fields
          isRecurring: true,
          recurringPattern,
          recurringGroupId,
          recurringInstance: index + 1,
          totalInstances: instances.length,
          recurringStartDate: startDate,
          recurringEndDate: endDate,
          
          // Metadata
          createdAt: new Date(),
          updatedAt: new Date()
        };

        batch.set(eventRef, eventData);
        createdEvents.push({
          id: eventRef.id,
          slug: instanceSlug,
          date: instanceDate.toISOString()
        });
      });

      await batch.commit();

      // Cache the series
      this.cache.set(recurringGroupId, {
        data: {
          id: recurringGroupId,
          name,
          pattern: recurringPattern,
          instances: createdEvents,
          totalInstances: instances.length
        },
        timestamp: Date.now()
      });

      return {
        recurringGroupId,
        instances: createdEvents,
        totalInstances: instances.length
      };

    } catch (error) {
      console.error('Error creating recurring series:', error);
      throw new Error('Failed to create recurring series');
    }
  }

  /**
   * Get all instances of a recurring event series
   */
  async getRecurringSeriesInstances(recurringGroupId, options = {}) {
    const { futureOnly = true, limit = 10 } = options;
    
    const cacheKey = `series:${recurringGroupId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return this.filterInstances(cached.data.instances, futureOnly, limit);
    }

    try {
      const eventsRef = this.db.collection('events');
      const snapshot = await eventsRef
        .where('recurringGroupId', '==', recurringGroupId)
        .where('status', '==', 'approved')
        .orderBy('date')
        .get();

      if (snapshot.empty) {
        return [];
      }

      const instances = [];
      snapshot.forEach(doc => {
        instances.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Cache the result
      this.cache.set(cacheKey, {
        data: { instances },
        timestamp: Date.now()
      });

      return this.filterInstances(instances, futureOnly, limit);

    } catch (error) {
      console.error('Error getting recurring series instances:', error);
      throw new Error('Failed to get series instances');
    }
  }

  /**
   * Update a recurring event series (all future instances)
   */
  async updateRecurringSeries(recurringGroupId, updates) {
    try {
      // Get all future instances
      const instances = await this.getRecurringSeriesInstances(recurringGroupId, { futureOnly: true });
      
      if (instances.length === 0) {
        throw new Error('No future instances found for this series');
      }

      // Update all instances in a batch
      const batch = this.db.batch();
      
      instances.forEach(instance => {
        const eventRef = this.db.collection('events').doc(instance.id);
        batch.update(eventRef, {
          ...updates,
          updatedAt: new Date()
        });
      });

      await batch.commit();

      // Clear cache
      this.clearCache(recurringGroupId);

      return {
        updatedInstances: instances.length,
        message: `Updated ${instances.length} future instances`
      };

    } catch (error) {
      console.error('Error updating recurring series:', error);
      throw new Error('Failed to update recurring series');
    }
  }

  /**
   * End a recurring event series (cancel future instances)
   */
  async endRecurringSeries(recurringGroupId) {
    try {
      // Get all future instances
      const instances = await this.getRecurringSeriesInstances(recurringGroupId, { futureOnly: true });
      
      if (instances.length === 0) {
        throw new Error('No future instances found for this series');
      }

      // Cancel all future instances
      const batch = this.db.batch();
      
      instances.forEach(instance => {
        const eventRef = this.db.collection('events').doc(instance.id);
        batch.update(eventRef, {
          status: 'cancelled',
          updatedAt: new Date()
        });
      });

      await batch.commit();

      // Clear cache
      this.clearCache(recurringGroupId);

      return {
        cancelledInstances: instances.length,
        message: `Cancelled ${instances.length} future instances`
      };

    } catch (error) {
      console.error('Error ending recurring series:', error);
      throw new Error('Failed to end recurring series');
    }
  }

  /**
   * Group recurring events for display
   */
  groupRecurringEvents(events) {
    const groupedEvents = [];
    const recurringGroups = new Map();

    events.forEach(event => {
      if (event.isRecurring && event.recurringGroupId) {
        // This is a recurring event with a group ID
        if (recurringGroups.has(event.recurringGroupId)) {
          // Add to existing group
          const group = recurringGroups.get(event.recurringGroupId);
          group.instances.push(event);
          
          // Update group's next occurrence
          const eventDate = new Date(event.date);
          const groupDate = new Date(group.nextOccurrence);
          const now = new Date();
          
          if (eventDate >= now && eventDate < groupDate) {
            group.nextOccurrence = event.date;
          }
        } else {
          // Create new group
          const group = {
            id: event.recurringGroupId,
            name: event.name,
            description: event.description,
            category: event.category,
            venue: event.venue,
            image: event.image,
            link: event.link,
            price: event.price,
            ageRestriction: event.ageRestriction,
            
            // Recurring info
            isRecurringGroup: true,
            recurringPattern: event.recurringPattern,
            recurringStartDate: event.recurringStartDate,
            recurringEndDate: event.recurringEndDate,
            totalInstances: event.totalInstances,
            
            // Display info
            nextOccurrence: event.date,
            instances: [event],
            
            // Metadata
            createdAt: event.createdAt,
            updatedAt: event.updatedAt
          };
          
          recurringGroups.set(event.recurringGroupId, group);
        }
      } else {
        // Non-recurring event, add directly
        groupedEvents.push(event);
      }
    });

    // Add grouped recurring events
    recurringGroups.forEach(group => {
      // Sort instances by date
      group.instances.sort((a, b) => new Date(a.date) - new Date(b.date));
      groupedEvents.push(group);
    });

    return groupedEvents;
  }

  /**
   * Calculate recurring event instances
   */
  calculateRecurringInstances({ startDate, endDate, pattern, maxInstances, time = '20:00' }) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    // Set the time
    const [hours, minutes] = time.split(':').map(Number);
    start.setHours(hours, minutes, 0, 0);
    
    const instances = [];
    let current = new Date(start);
    let count = 0;

    while (count < maxInstances) {
      if (end && current > end) {
        break;
      }

      // Create a new Date object to avoid mutation issues
      instances.push(new Date(current.getTime()));
      count++;

      switch (pattern) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'bi-weekly':
          current.setDate(current.getDate() + 14);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + 1);
          break;
        default:
          return instances;
      }
    }

    return instances;
  }

  /**
   * Filter instances based on options
   */
  filterInstances(instances, futureOnly = true, limit = 10) {
    let filtered = instances;

    if (futureOnly) {
      const now = new Date();
      filtered = instances.filter(instance => new Date(instance.date) > now);
    }

    return filtered.slice(0, limit);
  }

  /**
   * Generate slug from event name
   */
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Clear cache for a specific series
   */
  clearCache(recurringGroupId = null) {
    if (recurringGroupId) {
      this.cache.delete(`series:${recurringGroupId}`);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get recurring event statistics
   */
  async getRecurringStats() {
    try {
      const eventsRef = this.db.collection('events');
      const snapshot = await eventsRef
        .where('isRecurring', '==', true)
        .where('status', '==', 'approved')
        .get();

      const stats = {
        totalSeries: 0,
        totalInstances: 0,
        activeSeries: 0,
        patterns: {}
      };

      const seriesGroups = new Map();

      snapshot.forEach(doc => {
        const event = doc.data();
        stats.totalInstances++;

        if (event.recurringGroupId) {
          if (!seriesGroups.has(event.recurringGroupId)) {
            seriesGroups.set(event.recurringGroupId, {
              pattern: event.recurringPattern,
              instances: 0,
              hasFutureInstances: false
            });
            stats.totalSeries++;
          }

          const series = seriesGroups.get(event.recurringGroupId);
          series.instances++;

          // Check if this is a future instance
          if (new Date(event.date) > new Date()) {
            series.hasFutureInstances = true;
          }

          // Count patterns
          const pattern = event.recurringPattern || 'unknown';
          stats.patterns[pattern] = (stats.patterns[pattern] || 0) + 1;
        }
      });

      // Count active series (those with future instances)
      seriesGroups.forEach(series => {
        if (series.hasFutureInstances) {
          stats.activeSeries++;
        }
      });

      return stats;

    } catch (error) {
      console.error('Error getting recurring stats:', error);
      throw new Error('Failed to get recurring stats');
    }
  }
}

module.exports = RecurringEventsManager; 