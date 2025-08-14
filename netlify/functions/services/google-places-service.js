const admin = require('firebase-admin');

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

const db = admin.firestore();

class GooglePlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    this.cache = new Map();
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
    this.enabled = !!this.apiKey;
    
    if (!this.enabled) {
      console.warn('⚠️ Google Places API key not found. Service will return empty data.');
    }
  }

  /**
   * Get Google Places data for a venue
   * @param {Object} venueData - Venue data object
   * @param {Object} options - Options for data fetching
   * @returns {Object} Google Places data
   */
  async getVenueGooglePlacesData(venueData, options = {}) {
    const {
      useCache = true,
      maxImages = 8,
      maxReviews = 5,
      forceRefresh = false
    } = options;

    const placeId = venueData.googlePlaceId || venueData['Google Place ID'] || venueData.google_place_id;
    
    if (!placeId) {
      console.log(`📍 No Google Place ID found for venue: ${venueData.name}`);
      return this.getEmptyGooglePlacesData();
    }

    if (!this.enabled) {
      console.log(`🚫 Google Places API not enabled for venue: ${venueData.name}`);
      return this.getEmptyGooglePlacesData();
    }

    const cacheKey = `places_${placeId}`;
    
    // Check cache first
    if (useCache && !forceRefresh && this.cache.has(cacheKey)) {
      const cachedData = this.cache.get(cacheKey);
      if (Date.now() - cachedData.timestamp < this.cacheExpiration) {
        console.log(`📦 Using cached Google Places data for: ${venueData.name}`);
        return cachedData.data;
      }
    }

    try {
      console.log(`🔍 Fetching Google Places data for: ${venueData.name} (Place ID: ${placeId})`);
      
      const placesData = await this.fetchPlaceDetails(placeId, maxImages, maxReviews);
      
      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, {
          data: placesData,
          timestamp: Date.now()
        });
        
        // Also store in Firestore for persistent caching
        await this.storePlacesDataInFirestore(placeId, placesData);
      }

      console.log(`✅ Successfully fetched Google Places data for: ${venueData.name}`);
      return placesData;

    } catch (error) {
      console.error(`❌ Error fetching Google Places data for ${venueData.name}:`, error);
      
      // Try to get cached data from Firestore as fallback
      const fallbackData = await this.getPlacesDataFromFirestore(placeId);
      if (fallbackData) {
        console.log(`📦 Using Firestore cached data as fallback for: ${venueData.name}`);
        return fallbackData;
      }
      
      return this.getEmptyGooglePlacesData();
    }
  }

  /**
   * Fetch place details from Google Places API
   * @param {string} placeId - Google Place ID
   * @param {number} maxImages - Maximum number of images to fetch
   * @param {number} maxReviews - Maximum number of reviews to fetch
   * @returns {Object} Place details
   */
  async fetchPlaceDetails(placeId, maxImages = 8, maxReviews = 5) {
    const fields = [
      'photos',
      'reviews', 
      'rating',
      'user_ratings_total',
      'opening_hours',
      'formatted_phone_number',
      'website',
      'business_status'
    ].join(',');

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.apiKey}`;
    
    const response = await fetch(detailsUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    const result = data.result;
    
    return {
      images: await this.processPhotos(result.photos || [], maxImages),
      reviews: this.processReviews(result.reviews || [], maxReviews),
      rating: result.rating || null,
      reviewCount: result.user_ratings_total || 0,
      openingHours: result.opening_hours?.weekday_text || [],
      isOpen: result.opening_hours?.open_now || null,
      phone: result.formatted_phone_number || null,
      website: result.website || null,
      businessStatus: result.business_status || null,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Process Google Places photos
   * @param {Array} photos - Google Places photos array
   * @param {number} maxImages - Maximum number of images to process
   * @returns {Array} Processed image objects
   */
  async processPhotos(photos, maxImages) {
    const images = [];
    const photoLimit = Math.min(photos.length, maxImages);
    
    for (let i = 0; i < photoLimit; i++) {
      const photo = photos[i];
      const imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&maxheight=600&photo_reference=${photo.photo_reference}&key=${this.apiKey}`;
      
      images.push({
        url: imageUrl,
        width: photo.width || 800,
        height: photo.height || 600,
        source: 'google_places'
      });
    }
    
    return images;
  }

  /**
   * Process Google Places reviews
   * @param {Array} reviews - Google Places reviews array
   * @param {number} maxReviews - Maximum number of reviews to process
   * @returns {Array} Processed review objects
   */
  processReviews(reviews, maxReviews) {
    const processedReviews = [];
    const reviewLimit = Math.min(reviews.length, maxReviews);
    
    for (let i = 0; i < reviewLimit; i++) {
      const review = reviews[i];
      processedReviews.push({
        author: review.author_name,
        rating: review.rating,
        text: review.text,
        time: review.time,
        relativeTime: review.relative_time_description,
        profilePhoto: review.profile_photo_url,
        source: 'google_places'
      });
    }
    
    return processedReviews;
  }

  /**
   * Store Google Places data in Firestore for caching
   * @param {string} placeId - Google Place ID
   * @param {Object} placesData - Places data to cache
   */
  async storePlacesDataInFirestore(placeId, placesData) {
    try {
      await db.collection('google_places_cache').doc(placeId).set({
        ...placesData,
        cachedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.warn('Failed to cache Google Places data in Firestore:', error);
    }
  }

  /**
   * Get cached Google Places data from Firestore
   * @param {string} placeId - Google Place ID
   * @returns {Object|null} Cached places data or null
   */
  async getPlacesDataFromFirestore(placeId) {
    try {
      const doc = await db.collection('google_places_cache').doc(placeId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      const data = doc.data();
      const cachedAt = data.cachedAt?.toDate() || new Date(0);
      
      // Check if cache is still valid (within 7 days for Firestore cache)
      const cacheAge = Date.now() - cachedAt.getTime();
      if (cacheAge > 7 * 24 * 60 * 60 * 1000) { // 7 days
        return null;
      }
      
      // Remove Firestore metadata
      delete data.cachedAt;
      
      return data;
    } catch (error) {
      console.warn('Failed to get cached Google Places data from Firestore:', error);
      return null;
    }
  }

  /**
   * Get empty Google Places data structure
   * @returns {Object} Empty places data
   */
  getEmptyGooglePlacesData() {
    return {
      images: [],
      reviews: [],
      rating: null,
      reviewCount: 0,
      openingHours: [],
      isOpen: null,
      phone: null,
      website: null,
      businessStatus: null,
      lastUpdated: null
    };
  }

  /**
   * Clear cache for a specific place
   * @param {string} placeId - Google Place ID
   */
  async clearCache(placeId) {
    const cacheKey = `places_${placeId}`;
    this.cache.delete(cacheKey);
    
    try {
      await db.collection('google_places_cache').doc(placeId).delete();
    } catch (error) {
      console.warn('Failed to clear Firestore cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    this.cache.clear();
    
    try {
      const batch = db.batch();
      const snapshot = await db.collection('google_places_cache').get();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      console.warn('Failed to clear all Firestore cache:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      memoryCache: {
        size: this.cache.size,
        entries: Array.from(this.cache.keys())
      },
      apiEnabled: this.enabled,
      cacheExpiration: this.cacheExpiration
    };
  }

  /**
   * Search for venues using Google Places API
   * @param {string} query - Search query
   * @returns {Array} Search results
   */
  async searchVenues(query) {
    if (!this.enabled) {
      return [];
    }

    try {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=establishment&key=${this.apiKey}`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();
      
      if (data.status !== 'OK') {
        console.error(`Google Places search error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        return [];
      }

      return data.results.map(place => ({
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
        types: place.types,
        photos: place.photos ? place.photos.length : 0
      }));

    } catch (error) {
      console.error('Error searching Google Places:', error);
      return [];
    }
  }

  /**
   * Test Google Places API connectivity
   * @returns {Object} Test results
   */
  async testConnection() {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Google Places API key not configured'
      };
    }

    try {
      // Test with a known place ID (Google headquarters)
      const testPlaceId = 'ChIJj61dQgK6j4AR4GeTYWZsKWw';
      const testUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${testPlaceId}&fields=name,rating&key=${this.apiKey}`;
      
      const response = await fetch(testUrl);
      const data = await response.json();
      
      if (data.status === 'OK') {
        return {
          success: true,
          message: 'Google Places API connection successful',
          testResult: data.result
        };
      } else {
        return {
          success: false,
          error: `API Error: ${data.status} - ${data.error_message || 'Unknown error'}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Connection failed: ${error.message}`
      };
    }
  }
}

module.exports = GooglePlacesService; 