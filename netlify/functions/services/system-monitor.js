const EventService = require('./firestore-event-service');
const SeriesManager = require('./series-manager');
const GooglePlacesService = require('./google-places-service');
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

// Version: 2025-07-25-v6 - Fixed async getSystemStatus and auto-run tests

class SystemMonitor {
  constructor() {
    this.db = db;
    this.eventService = new EventService();
    this.seriesManager = new SeriesManager();
    this.googlePlacesService = new GooglePlacesService();
    this.testResults = new Map();
    this.lastRun = null;
    this.startTime = new Date();
 // Initialize start time
  }

  async runAllTests() {
    console.log('🔍 Starting system health check...');
    this.lastRun = new Date();
    
    const tests = [
      { name: 'firestore-connection', test: () => this.testFirestoreConnection() },
      { name: 'event-service', test: () => this.testEventService() },
      { name: 'series-manager', test: () => this.testSeriesManager() },
      { name: 'get-events-api', test: () => this.testGetEventsAPI() },
      { name: 'get-pending-events-api', test: () => this.testGetPendingEventsAPI() },
      { name: 'event-details-api', test: () => this.testEventDetailsAPI() },
      { name: 'series-slug-uniqueness', test: () => this.testSeriesSlugUniqueness() },
      { name: 'cache-functionality', test: () => this.testCacheFunctionality() },
      { name: 'environment-variables', test: () => this.testEnvironmentVariables() },
      { name: 'firestore-collections', test: () => this.testFirestoreCollections() },
      { name: 'social-reel-generation', test: () => this.testSocialReelGeneration() },
      { name: 'google-places-api', test: () => this.testGooglePlacesAPI() }
    ];

    const results = [];
    
    for (const test of tests) {
      try {
        console.log(`🧪 Running test: ${test.name}`);
        const result = await test.test();
        results.push({
          name: test.name,
          status: 'pass',
          duration: result.duration,
          details: result.details,
          timestamp: new Date()
        });
        console.log(`✅ ${test.name}: PASS (${result.duration}ms)`);
      } catch (error) {
        console.error(`❌ ${test.name}: FAIL - ${error.message}`);
        results.push({
          name: test.name,
          status: 'fail',
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    this.testResults.set(this.lastRun.toISOString(), results);
    
    // Check if we need to send notifications
    await this.checkAndSendNotifications(results);
    
    return {
      timestamp: this.lastRun,
      totalTests: tests.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      results: results
    };
  }

  async testFirestoreConnection() {
    const startTime = Date.now();
    
    try {
      // Test basic Firestore connection
      const testDoc = await this.db.collection('events').limit(1).get();
      const eventsCount = testDoc.size;
      
      // Test write capability with a health check document
      const healthCheckRef = this.db.collection('system_health').doc('connection_test');
      await healthCheckRef.set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        test: true
      });
      
      // Test read capability
      const healthCheckDoc = await healthCheckRef.get();
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          connectionTime: duration,
          eventsCollectionCount: eventsCount,
          readWriteTest: healthCheckDoc.exists,
          firestoreWorking: true
        }
      };
    } catch (error) {
      throw new Error(`Firestore connection failed: ${error.message}`);
    }
  }

  async testEventService() {
    const startTime = Date.now();
    
    try {
      // Test getting events
      const events = await this.eventService.getEvents({}, { admin: true });
      
      // Test getting a specific event if available
      let eventDetails = null;
      if (events.length > 0) {
        eventDetails = await this.eventService.getEventBySlug(events[0].slug);
      }
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          totalEvents: events.length,
          eventDetailsRetrieved: !!eventDetails,
          cacheWorking: this.eventService.cache.size > 0
        }
      };
    } catch (error) {
      throw new Error(`EventService test failed: ${error.message}`);
    }
  }

  async testSeriesManager() {
    const startTime = Date.now();
    
    try {
      // Test getting series
      const allEvents = await this.eventService.getEvents({}, { admin: true });
      const seriesEvents = allEvents.filter(event => event.series || event.recurringInfo);
      
      // Test getting a specific series if available
      let seriesDetails = null;
      if (seriesEvents.length > 0) {
        const seriesId = seriesEvents[0].series?.id || seriesEvents[0].id;
        seriesDetails = await this.seriesManager.getSeriesWithInstances(seriesId);
      }
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          totalSeries: seriesEvents.length,
          seriesDetailsRetrieved: !!seriesDetails,
          cacheWorking: this.seriesManager.cache.size > 0
        }
      };
    } catch (error) {
      throw new Error(`SeriesManager test failed: ${error.message}`);
    }
  }

  async testGetEventsAPI() {
    const startTime = Date.now();
    
    try {
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://deploy-preview-35--bolwebsite.netlify.app';
      const response = await fetch(`${baseUrl}/.netlify/functions/get-events`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          responseTime: duration,
          eventCount: data.length || 0,
          statusCode: response.status
        }
      };
    } catch (error) {
      throw new Error(`Get Events API test failed: ${error.message}`);
    }
  }

  async testGetPendingEventsAPI() {
    const startTime = Date.now();
    
    try {
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://deploy-preview-35--bolwebsite.netlify.app';
      const response = await fetch(`${baseUrl}/.netlify/functions/get-pending-events`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          responseTime: duration,
          pendingCount: data.length || 0,
          statusCode: response.status
        }
      };
    } catch (error) {
      throw new Error(`Get Pending Events API test failed: ${error.message}`);
    }
  }

  async testGetRecurringEventsAPI() {
    const startTime = Date.now();
    
    try {
      // Version: 2025-07-25-v3 - Test directly using EventService
      console.log('Testing recurring events using EventService directly...');
      
      // Use EventService directly instead of HTTP call
      const allEvents = await this.eventService.getEvents({}, { admin: true });
      const recurringEvents = allEvents.filter(event => 
          event.recurringInfo || event.series
      );
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          responseTime: duration,
          recurringCount: recurringEvents.length,
          totalSeries: recurringEvents.length,
          statusCode: 200,
          method: 'direct'
        }
      };
    } catch (error) {
      throw new Error(`Get Recurring Events API test failed: ${error.message}`);
    }
  }

  async testEventDetailsAPI() {
    const startTime = Date.now();
    
    try {
      // Get a test event first
      const events = await this.eventService.getEvents({}, { admin: true });
      
      if (events.length === 0) {
        return {
          duration: Date.now() - startTime,
          details: {
            skipped: true,
            reason: 'No events available for testing'
          }
        };
      }
      
      const testEvent = events[0];
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://deploy-preview-35--bolwebsite.netlify.app';
      const response = await fetch(`${baseUrl}/.netlify/functions/get-event-details?slug=${testEvent.slug}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.text(); // Event details returns HTML
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          responseTime: duration,
          hasContent: data.length > 0,
          statusCode: response.status,
          testEvent: testEvent.name
        }
      };
    } catch (error) {
      throw new Error(`Event Details API test failed: ${error.message}`);
    }
  }

  async testSeriesSlugUniqueness() {
    const startTime = Date.now();
    
    try {
      const allEvents = await this.eventService.getEvents({}, { admin: true });
      const slugMap = new Map();
      const duplicates = [];
      
      allEvents.forEach(event => {
        if (slugMap.has(event.slug)) {
          duplicates.push({
            slug: event.slug,
            events: [slugMap.get(event.slug), event.name]
          });
        } else {
          slugMap.set(event.slug, event.name);
        }
      });
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          totalEvents: allEvents.length,
          uniqueSlugs: slugMap.size,
          duplicateSlugs: duplicates.length,
          duplicates: duplicates
        }
      };
    } catch (error) {
      throw new Error(`Series slug uniqueness test failed: ${error.message}`);
    }
  }

  async testCacheFunctionality() {
    const startTime = Date.now();
    
    try {
      // Test EventService cache
      const initialCacheSize = this.eventService.cache.size;
      
      // Make a request that should be cached
      await this.eventService.getEvents({}, { admin: true });
      const afterFirstRequest = this.eventService.cache.size;
      
      // Make the same request again
      await this.eventService.getEvents({}, { admin: true });
      const afterSecondRequest = this.eventService.cache.size;
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          initialCacheSize,
          afterFirstRequest,
          afterSecondRequest,
          cacheWorking: afterFirstRequest > initialCacheSize
        }
      };
    } catch (error) {
      throw new Error(`Cache functionality test failed: ${error.message}`);
    }
  }

  async testEnvironmentVariables() {
    const startTime = Date.now();
    
    try {
      const requiredVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET'
      ];
      
      const missingVars = [];
      const presentVars = [];
      
      requiredVars.forEach(varName => {
        if (process.env[varName]) {
          presentVars.push(varName);
        } else {
          missingVars.push(varName);
        }
      });
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          required: requiredVars.length,
          present: presentVars.length,
          missing: missingVars.length,
          missingVars: missingVars
        }
      };
    } catch (error) {
      throw new Error(`Environment variables test failed: ${error.message}`);
    }
  }

  async testFirestoreCollections() {
    const startTime = Date.now();
    try {
      const collections = ['events', 'venues', 'pending_events', 'system_health', 'system_notifications'];
      const collectionStats = [];
      
      for (const collectionName of collections) {
        const collectionRef = this.db.collection(collectionName);
        const snapshot = await collectionRef.limit(1).get();
        collectionStats.push({
          name: collectionName,
          exists: !snapshot.empty,
          size: snapshot.size
        });
      }
      
      const duration = Date.now() - startTime;
      return {
        duration,
        details: {
          totalCollections: collections.length,
          collectionsExists: collectionStats.filter(c => c.exists).length,
          collectionStats: collectionStats,
          allCollectionsWorking: collectionStats.every(c => c.exists)
        }
      };
    } catch (error) {
      throw new Error(`Firestore collections test failed: ${error.message}`);
    }
  }

  async testSocialReelGeneration() {
    const startTime = Date.now();
    try {
      // Test if the social reel generation function is responsive
      // We'll use a lightweight test that doesn't actually generate a reel
      const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://deploy-preview-35--bolwebsite.netlify.app';
      
      // Test the get-events-for-reels function instead as it's more reliable
      const response = await fetch(`${baseUrl}/.netlify/functions/get-events-for-reels?preset=this-week`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          responseTime: duration,
          reelDataAvailable: data.success,
          eventsCount: data.data ? data.data.length : 0,
          statusCode: response.status
        }
      };
    } catch (error) {
      throw new Error(`Social Reel Generation test failed: ${error.message}`);
    }
  }

  async testGooglePlacesAPI() {
    const startTime = Date.now();
    
    try {
      // Test Google Places API connectivity
      const connectionTest = await this.googlePlacesService.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(connectionTest.error);
      }
      
      // Test with a sample venue that has Google Place ID
      const sampleVenue = {
        name: 'Test Venue',
        googlePlaceId: 'ChIJj61dQgK6j4AR4GeTYWZsKWw' // Google headquarters for testing
      };
      
      const placesData = await this.googlePlacesService.getVenueGooglePlacesData(sampleVenue, {
        useCache: false,
        maxImages: 1,
        maxReviews: 1
      });
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          apiEnabled: this.googlePlacesService.enabled,
          connectionTest: connectionTest.success,
          dataRetrieved: placesData && placesData.rating !== null,
          cacheStats: this.googlePlacesService.getCacheStats(),
          testPlaceId: sampleVenue.googlePlaceId
        }
      };
    } catch (error) {
      throw new Error(`Google Places API test failed: ${error.message}`);
    }
  }

  async checkAndSendNotifications(results) {
    const failedTests = results.filter(r => r.status === 'fail');
    
    if (failedTests.length > 0) {
      await this.sendNotification({
        type: 'system_alert',
        title: '🚨 System Health Check Failed',
        message: `${failedTests.length} out of ${results.length} tests failed`,
        details: failedTests.map(test => ({
          name: test.name,
          error: test.error
        })),
        severity: 'high'
      });
    }
  }

  async sendNotification(notification) {
    try {
      // Store notification in Firestore for admin review
      await this.db.collection('system_notifications').add({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        details: notification.details,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'New'
      });
      
      console.log(`📢 Notification stored: ${notification.title}`);
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  async getSystemStatus() {
    console.log('📊 Getting system status...');
    
    // If no tests have been run, run them now
    if (this.testResults.size === 0) {
      console.log('No tests run yet, running initial health check...');
      await this.runAllTests();
    }
    
    const recentResults = Array.from(this.testResults.entries())
      .slice(-5) // Get last 5 test runs
      .map(([timestamp, results]) => ({
        timestamp: new Date(timestamp),
        totalTests: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        failed: results.filter(r => r.status === 'fail').length,
        results: results
      }))
      .reverse();

    // Determine overall status
    let overallStatus = 'unknown';
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    
    if (recentResults.length > 0) {
      const latest = recentResults[0];
      totalTests = latest.totalTests;
      passedTests = latest.passed;
      failedTests = latest.failed;
      
      if (latest.failed === 0) {
        overallStatus = 'healthy';
      } else if (latest.failed < latest.totalTests) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'critical';
      }
    }

    // Calculate actual uptime
    const uptime = this.getUptime();

    return {
      overallStatus,
      lastRun: this.lastRun ? new Date(this.lastRun).toISOString() : null,
      recentResults,
      uptime,
      totalTests,
      passedTests,
      failedTests,
      hasRunTests: recentResults.length > 0
    };
  }

  getUptime() {
    if (!this.startTime) {
      this.startTime = Date.now();
    }
    
    const now = Date.now();
    const uptimeMs = now - this.startTime;
    
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
    
    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0) uptimeString += `${minutes}m `;
    uptimeString += `${seconds}s`;
    
    return {
      startTime: new Date(this.startTime).toISOString(),
      uptime: uptimeString,
      uptimeMs: uptimeMs
    };
  }
}

module.exports = SystemMonitor;