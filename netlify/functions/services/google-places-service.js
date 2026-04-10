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

// Bumped to v1 when migrating from legacy Places API to Places API (New) v1.
// Changing the prefix invalidates stale cache entries that were stored under
// the legacy fetch path so they get re-hydrated from the new API.
const CACHE_COLLECTION = 'google_places_cache_v1';
const CACHE_KEY_PREFIX = 'places_v1_';

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

    const cacheKey = `${CACHE_KEY_PREFIX}${placeId}`;

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
   * Fetch place details from Google Places API (New) v1.
   * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
   */
  async fetchPlaceDetails(placeId, maxImages = 8, maxReviews = 5) {
    const fieldMask = [
      // Existing-equivalent fields
      'photos',
      'reviews',
      'rating',
      'userRatingCount',
      'regularOpeningHours',
      'currentOpeningHours.openNow',
      'nationalPhoneNumber',
      'internationalPhoneNumber',
      'websiteUri',
      'businessStatus',
      // Amenity flags
      'servesBeer',
      'servesWine',
      'servesCocktails',
      'servesCoffee',
      'liveMusic',
      'outdoorSeating',
      'goodForGroups',
      'allowsDogs',
      // Accessibility
      'accessibilityOptions',
      // Misc
      'googleMapsUri',
      'editorialSummary',
      'priceLevel',
    ].join(',');

    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Places API error: ${response.status} - ${body}`);
    }

    const result = await response.json();

    return {
      // Preserved keys (consumers depend on these)
      images: this.processPhotos(result.photos || [], maxImages),
      reviews: this.processReviews(result.reviews || [], maxReviews),
      rating: result.rating ?? null,
      reviewCount: result.userRatingCount ?? 0,
      openingHours: result.regularOpeningHours?.weekdayDescriptions || [],
      isOpen: result.currentOpeningHours?.openNow ?? null,
      phone: result.nationalPhoneNumber || result.internationalPhoneNumber || null,
      website: result.websiteUri || null,
      businessStatus: result.businessStatus || null,
      lastUpdated: new Date().toISOString(),
      // New keys
      amenities: {
        servesBeer: result.servesBeer ?? null,
        servesWine: result.servesWine ?? null,
        servesCocktails: result.servesCocktails ?? null,
        servesCoffee: result.servesCoffee ?? null,
        liveMusic: result.liveMusic ?? null,
        outdoorSeating: result.outdoorSeating ?? null,
        goodForGroups: result.goodForGroups ?? null,
        allowsDogs: result.allowsDogs ?? null,
      },
      accessibility: result.accessibilityOptions || null,
      googleMapsUri: result.googleMapsUri || null,
      editorialSummary: result.editorialSummary?.text || null,
      priceLevel: result.priceLevel || null,
    };
  }

  /**
   * Process Google Places photos.
   * Places API (New) returns `photos[].name` like `places/{placeId}/photos/{photoId}`,
   * fetched via `https://places.googleapis.com/v1/{name}/media`.
   * We embed the API key in the URL so the browser can load images directly,
   * matching the legacy behaviour.
   */
  processPhotos(photos, maxImages) {
    return photos.slice(0, maxImages).map((photo) => {
      const attribution = photo.authorAttributions?.[0] || null;
      return {
        url: `https://places.googleapis.com/v1/${photo.name}/media`
          + `?maxWidthPx=800&maxHeightPx=600&key=${this.apiKey}`,
        width: photo.widthPx || 800,
        height: photo.heightPx || 600,
        source: 'google_places',
        attribution: attribution
          ? { name: attribution.displayName, uri: attribution.uri || null }
          : null,
      };
    });
  }

  /**
   * Process Google Places reviews (New API shape).
   */
  processReviews(reviews, maxReviews) {
    return reviews.slice(0, maxReviews).map((review) => ({
      author: review.authorAttribution?.displayName || 'Anonymous',
      authorUri: review.authorAttribution?.uri || null,
      rating: review.rating,
      text: review.text?.text || review.originalText?.text || '',
      time: review.publishTime,
      relativeTime: review.relativePublishTimeDescription,
      profilePhoto: review.authorAttribution?.photoUri || null,
      source: 'google_places',
    }));
  }

  /**
   * Store Google Places data in Firestore for caching
   */
  async storePlacesDataInFirestore(placeId, placesData) {
    try {
      await db.collection(CACHE_COLLECTION).doc(placeId).set({
        ...placesData,
        cachedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.warn('Failed to cache Google Places data in Firestore:', error);
    }
  }

  /**
   * Get cached Google Places data from Firestore
   */
  async getPlacesDataFromFirestore(placeId) {
    try {
      const doc = await db.collection(CACHE_COLLECTION).doc(placeId).get();

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
      lastUpdated: null,
      amenities: {
        servesBeer: null,
        servesWine: null,
        servesCocktails: null,
        servesCoffee: null,
        liveMusic: null,
        outdoorSeating: null,
        goodForGroups: null,
        allowsDogs: null,
      },
      accessibility: null,
      googleMapsUri: null,
      editorialSummary: null,
      priceLevel: null,
    };
  }

  /**
   * Clear cache for a specific place
   */
  async clearCache(placeId) {
    const cacheKey = `${CACHE_KEY_PREFIX}${placeId}`;
    this.cache.delete(cacheKey);

    try {
      await db.collection(CACHE_COLLECTION).doc(placeId).delete();
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
      const snapshot = await db.collection(CACHE_COLLECTION).get();

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
   * Search for venues using Places API (New) Text Search.
   * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
   */
  async searchVenues(query) {
    if (!this.enabled) {
      return [];
    }

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types,places.photos',
        },
        body: JSON.stringify({ textQuery: query }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Google Places search error: ${response.status} - ${body}`);
        return [];
      }

      const data = await response.json();
      return (data.places || []).map((place) => ({
        placeId: place.id,
        name: place.displayName?.text,
        address: place.formattedAddress,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
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
      const response = await fetch(`https://places.googleapis.com/v1/places/${testPlaceId}`, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'id,displayName,rating',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Google Places API connection successful',
          testResult: data
        };
      }

      const body = await response.text();
      return {
        success: false,
        error: `API Error: ${response.status} - ${body}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Connection failed: ${error.message}`
      };
    }
  }
}

module.exports = GooglePlacesService;
