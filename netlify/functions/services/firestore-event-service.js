const admin = require('firebase-admin');
const SlugGenerator = require('../utils/slug-generator');

// Version: 2025-01-27-v1 - Firestore-based event service
class FirestoreEventService {
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
      // Try to find event by slug
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
    try {
      const eventsRef = this.db.collection('events');
      const snapshot = await eventsRef
        .where('slug', '==', slug)
        .limit(10)
        .get();

      if (snapshot.empty) return null;

      const events = [];
      snapshot.forEach(doc => {
        events.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Handle series events - find the parent event (has recurringInfo)
      const parentEvent = events.find(event => event.recurringInfo);
      if (parentEvent) {
        console.log(`Found series event: ${parentEvent.name} with ${events.length} instances`);
        return this.processSeriesEvent(parentEvent, events);
      }

      // If no parent event found but we have multiple records with same slug,
      // this might be a series where the parent doesn't have recurringInfo
      if (events.length > 1) {
        console.log(`Multiple events found with same slug: ${slug}, returning first one`);
        // Sort by date and return the earliest future event
        const sortedEvents = events.sort((a, b) => new Date(a.date) - new Date(b.date));
        const futureEvents = sortedEvents.filter(event => new Date(event.date) > new Date());
        const eventToReturn = futureEvents.length > 0 ? futureEvents[0] : sortedEvents[0];
        return this.processStandaloneEvent(eventToReturn);
      }

      // Handle standalone events
      return this.processStandaloneEvent(events[0]);
      
    } catch (error) {
      console.error('Error finding event by slug:', error);
      return null;
    }
  }

  async searchEventByName(searchTerm) {
    try {
      const eventsRef = this.db.collection('events');
      const snapshot = await eventsRef
        .where('name', '>=', searchTerm)
        .where('name', '<=', searchTerm + '\uf8ff')
        .limit(5)
        .get();

      if (snapshot.empty) return null;

      const events = [];
      snapshot.forEach(doc => {
        events.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Return the first matching event
      return events.length > 0 ? this.processStandaloneEvent(events[0]) : null;
      
    } catch (error) {
      console.error('Error searching event by name:', error);
      return null;
    }
  }

  processSeriesEvent(parentEvent, allEvents) {
    const seriesId = parentEvent.seriesId || parentEvent.id;
    
    // Create the series event structure
    const seriesEvent = {
      id: parentEvent.id,
      name: parentEvent.name,
      slug: parentEvent.slug,
      description: parentEvent.description,
      category: parentEvent.category || [],
      recurringInfo: parentEvent.recurringInfo,
      image: parentEvent.image,
      promotion: parentEvent.promotion || {},
      series: {
        id: seriesId,
        type: 'recurring',
        totalInstances: allEvents.length
      },
      venue: this.extractVenueInfo(parentEvent),
      date: parentEvent.date,
      details: {
        price: parentEvent.price,
        ageRestriction: parentEvent.ageRestriction,
        link: parentEvent.link || parentEvent.ticketLink
      }
    };

    return seriesEvent;
  }

  processStandaloneEvent(eventData) {
    // Use standardized field names - no more legacy mapping
    const mappedData = {
      id: eventData.id,
      name: eventData.name,
      slug: eventData.slug,
      description: eventData.description,
      category: eventData.category || [],
      date: eventData.date,
      venueId: eventData.venueId,
      venueName: eventData.venueName,
      venueSlug: eventData.venueSlug,
      venueAddress: eventData.venueAddress,
      venueLink: eventData.venueLink,
      image: eventData.promoImage || eventData.image,
      cloudinaryPublicId: eventData.cloudinaryPublicId,
      price: eventData.price,
      ageRestriction: eventData.ageRestriction,
      link: eventData.link,
      ticketLink: eventData.ticketLink,
      seriesId: eventData.seriesId,
      featuredBannerStartDate: eventData.featuredBannerStartDate,
      featuredBannerEndDate: eventData.featuredBannerEndDate,
      boostedListingStartDate: eventData.boostedListingStartDate,
      boostedListingEndDate: eventData.boostedListingEndDate,
      
      // Recurring event fields (standardized)
      isRecurring: eventData.isRecurring || false,
      recurringPattern: eventData.recurringPattern,
      recurringInfo: eventData.recurringInfo,
      recurringGroupId: eventData.recurringGroupId,
      recurringInstance: eventData.recurringInstance,
      totalInstances: eventData.totalInstances,
      recurringStartDate: eventData.recurringStartDate,
      recurringEndDate: eventData.recurringEndDate
    };

    return {
      id: mappedData.id,
      name: mappedData.name,
      slug: mappedData.slug,
      description: mappedData.description,
      category: mappedData.category,
      date: mappedData.date,
      venue: this.extractVenueInfo(mappedData),
      image: this.extractImageInfo(mappedData),
      promotion: this.extractPromotionInfo(mappedData),
      details: {
        price: mappedData.price,
        ageRestriction: mappedData.ageRestriction,
        link: mappedData.link || mappedData.ticketLink
      },
      series: mappedData.seriesId ? {
        id: mappedData.seriesId,
        type: 'instance'
      } : null,
      
      // Recurring event data
      isRecurring: mappedData.isRecurring,
      recurringPattern: mappedData.recurringPattern,
      recurringInfo: mappedData.recurringInfo,
      recurringGroupId: mappedData.recurringGroupId,
      recurringInstance: mappedData.recurringInstance,
      totalInstances: mappedData.totalInstances,
      recurringStartDate: mappedData.recurringStartDate,
      recurringEndDate: mappedData.recurringEndDate
    };
  }

  extractVenueInfo(eventData) {
    if (eventData.venue) {
      return {
        id: eventData.venue.id,
        name: eventData.venue.name,
        address: eventData.venue.address,
        link: eventData.venue.link
      };
    }
    
    // Fallback to venue fields if venue object doesn't exist
    return {
      id: eventData.venueId,
      name: eventData.venueName || eventData.venueText,
      address: eventData.venueAddress,
      link: eventData.venueLink
    };
  }

  extractImageInfo(eventData) {
    // Check for standardized Cloudinary Public ID first
    const cloudinaryId = eventData.cloudinaryPublicId;
    if (cloudinaryId) {
      return {
        url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${cloudinaryId}`,
        alt: eventData.name
      };
    }
    
    // Check for standardized promo image
    const promoImage = eventData.promoImage;
    if (promoImage) {
      const imageUrl = typeof promoImage === 'string' ? promoImage : 
                      (promoImage.url || promoImage[0]?.url);
      
      if (imageUrl) {
        return {
          url: imageUrl,
          alt: eventData.name
        };
      }
    }
    
    // Check for generic image field
    const image = eventData.image;
    if (image) {
      const imageUrl = typeof image === 'string' ? image : 
                      (image.url || image[0]?.url);
      
      if (imageUrl) {
        return {
          url: imageUrl,
          alt: eventData.name
        };
      }
    }
    
    // Legacy fallbacks (for backward compatibility)
    const legacyCloudinaryId = eventData['Cloudinary Public ID'];
    if (legacyCloudinaryId) {
      return {
        url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200,h_675,c_limit/${legacyCloudinaryId}`,
        alt: eventData.name
      };
    }
    
    const legacyPromoImage = eventData['Promo Image'];
    if (legacyPromoImage && Array.isArray(legacyPromoImage) && legacyPromoImage.length > 0) {
      return {
        url: legacyPromoImage[0].url,
        alt: eventData.name
      };
    }
    
    return null;
  }

  extractPromotionInfo(eventData) {
    const promotion = {};
    
    if (eventData.featuredBannerStartDate && eventData.featuredBannerEndDate) {
      promotion.featured = {
        startDate: eventData.featuredBannerStartDate,
        endDate: eventData.featuredBannerEndDate
      };
    }
    
    if (eventData.boostedListingStartDate && eventData.boostedListingEndDate) {
      promotion.boosted = {
        startDate: eventData.boostedListingStartDate,
        endDate: eventData.boostedListingEndDate
      };
    }
    
    return promotion;
  }

  async getSimilarEvents(eventCategories, currentEventId, limit = 3) {
    try {
      if (!eventCategories || eventCategories.length === 0) {
        return [];
      }

      const eventsRef = this.db.collection('events');
      const snapshot = await eventsRef
        .where('category', 'array-contains-any', eventCategories)
        .where('status', '==', 'approved')
        .limit(limit + 1) // Get one extra to account for current event
        .get();

      if (snapshot.empty) return [];

      const events = [];
      snapshot.forEach(doc => {
        const eventData = {
          id: doc.id,
          ...doc.data()
        };
        
        // Exclude current event
        if (eventData.id !== currentEventId) {
          events.push(this.processStandaloneEvent(eventData));
        }
      });

      return events.slice(0, limit);
      
    } catch (error) {
      console.error('Error getting similar events:', error);
      return [];
    }
  }

  clearCache() {
    this.cache.clear();
  }

  clearEventCache(eventId) {
    // Clear cache for specific event
    for (const [key, value] of this.cache.entries()) {
      if (key.includes(eventId)) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = FirestoreEventService;