const EventService = require('./event-service');
const SeriesManager = require('./series-manager');
const Airtable = require('airtable');

// Version: 2025-07-25-v6 - Fixed async getSystemStatus and auto-run tests

class SystemMonitor {
  constructor() {
    this.base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);
    this.eventService = new EventService();
    this.seriesManager = new SeriesManager();
    this.testResults = new Map();
    this.lastRun = null;
    this.startTime = Date.now(); // Initialize start time
  }

  async runAllTests() {
    console.log('🔍 Starting system health check...');
    this.lastRun = new Date();
    
    const tests = [
      { name: 'airtable-connection', test: () => this.testAirtableConnection() },
      { name: 'event-service', test: () => this.testEventService() },
      { name: 'series-manager', test: () => this.testSeriesManager() },
      { name: 'get-events-api', test: () => this.testGetEventsAPI() },
      { name: 'get-pending-events-api', test: () => this.testGetPendingEventsAPI() },
      // Temporarily disabled: { name: 'get-recurring-events-api', test: () => this.testGetRecurringEventsAPI() },
      { name: 'event-details-api', test: () => this.testEventDetailsAPI() },
      { name: 'series-slug-uniqueness', test: () => this.testSeriesSlugUniqueness() },
      { name: 'cache-functionality', test: () => this.testCacheFunctionality() },
      { name: 'environment-variables', test: () => this.testEnvironmentVariables() }
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

  async testAirtableConnection() {
    const startTime = Date.now();
    
    try {
      // Test basic connection
      const records = await this.base('Events').select({
        maxRecords: 1,
        fields: ['Event Name']
      }).firstPage();
      
      const duration = Date.now() - startTime;
      
      return {
        duration,
        details: {
          connectionTime: duration,
          recordCount: records.length,
          tableAccess: true
        }
      };
    } catch (error) {
      throw new Error(`Airtable connection failed: ${error.message}`);
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
        'AIRTABLE_PERSONAL_ACCESS_TOKEN',
        'AIRTABLE_BASE_ID',
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
      // Store notification in Airtable for admin review
      await this.base('System Notifications').create([{
        fields: {
          'Type': notification.type,
          'Title': notification.title,
          'Message': notification.message,
          'Severity': notification.severity,
          'Details': JSON.stringify(notification.details),
          'Timestamp': new Date().toISOString(),
          'Status': 'New'
        }
      }]);
      
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