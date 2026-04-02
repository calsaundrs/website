/**
 * Netlify Function: Test Google Place ID Creation for Multiple Venues
 * 
 * This function tests the Google Place ID creation process on multiple venues
 * using the environment variables available in Netlify Functions.
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

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
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

class GooglePlaceIdFinder {
  constructor() {
    this.apiKey = GOOGLE_PLACES_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
  }

  /**
   * Find a Google Place ID using venue name and address
   * @param {string} venueName - Name of the venue
   * @param {string} address - Address of the venue
   * @returns {Promise<string|null>} - Google Place ID or null if not found
   */
  async findPlaceId(venueName, address) {
    try {
      // Use Find Place from Text API
      const query = `${venueName}, ${address}, Birmingham, UK`;
      const url = `${this.baseUrl}/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${this.apiKey}`;
      
      console.log(`🔍 Searching for: ${query}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
        const placeId = data.candidates[0].place_id;
        console.log(`✅ Found Place ID: ${placeId}`);
        return placeId;
      } else {
        console.log(`❌ No Place ID found for: ${venueName}`);
        console.log(`   Status: ${data.status}, Error: ${data.error_message || 'No error message'}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error finding Place ID for ${venueName}:`, error.message);
      return null;
    }
  }

  /**
   * Get detailed place information to verify it's the correct venue
   * @param {string} placeId - Google Place ID
   * @returns {Promise<Object|null>} - Place details or null if error
   */
  async getPlaceDetails(placeId) {
    try {
      const url = `${this.baseUrl}/details/json?place_id=${placeId}&fields=name,formatted_address,rating,user_ratings_total,opening_hours,formatted_phone_number,website&key=${this.apiKey}`;
      
      console.log(`🔍 Getting place details for: ${placeId}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.result) {
        return data.result;
      } else {
        console.log(`❌ Error getting place details: ${data.status}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error getting place details:`, error.message);
      return null;
    }
  }
}

class MultipleVenueTester {
  constructor() {
    this.placeFinder = new GooglePlaceIdFinder();
    // Test venues - we'll process these specific venues
    this.testVenues = [
      'Eden Bar',
      'Equator Bar', 
    ];
  }

  /**
   * Get venues by name from Firestore
   * @param {Array} venueNames - Array of venue names to find
   * @returns {Promise<Array>} - Array of venue documents
   */
  async getVenuesByName(venueNames) {
    try {
      const venuesRef = db.collection('venues');
      const venues = [];
      
      for (const venueName of venueNames) {
        const snapshot = await venuesRef.where('name', '==', venueName).get();
        
        if (!snapshot.empty) {
          const venue = snapshot.docs[0];
          console.log(`📋 Found venue: ${venue.data().name} (ID: ${venue.id})`);
          console.log(`📍 Address: ${venue.data().address}`);
          console.log(`🆔 Current Google Place ID: ${venue.data().googlePlaceId || 'None'}`);
          
          venues.push({
            id: venue.id,
            ...venue.data()
          });
        } else {
          console.log(`❌ No venue found with name: ${venueName}`);
        }
      }
      
      console.log(`📋 Found ${venues.length} venues out of ${venueNames.length} requested`);
      return venues;
    } catch (error) {
      console.error('❌ Error fetching venues:', error);
      throw error;
    }
  }

  /**
   * Update a venue with Google Place ID
   * @param {string} venueId - Firestore document ID
   * @param {string} placeId - Google Place ID
   * @returns {Promise<boolean>} - Success status
   */
  async updateVenueWithPlaceId(venueId, placeId) {
    try {
      console.log(`💾 Updating venue ${venueId} with Place ID: ${placeId}`);
      
      await db.collection('venues').doc(venueId).update({
        googlePlaceId: placeId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Successfully updated venue ${venueId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating venue ${venueId}:`, error);
      return false;
    }
  }

  /**
   * Process multiple venues and add Google Place IDs
   */
  async processTestVenues() {
    try {
      console.log('🧪 Starting multiple venue Google Place ID test...\n');
      console.log(`🎯 Testing venues: ${this.testVenues.join(', ')}\n`);
      
      const venues = await this.getVenuesByName(this.testVenues);
      const results = {
        total: venues.length,
        updated: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        venues: []
      };

      for (const venue of venues) {
        console.log(`\n📍 Processing: ${venue.name}`);
        
        const venueResult = {
          name: venue.name,
          id: venue.id,
          success: false,
          placeId: null,
          placeDetails: null,
          error: null
        };
        
        // Skip if already has a Place ID
        if (venue.googlePlaceId || venue['Google Place ID'] || venue.google_place_id) {
          console.log(`⏭️  Skipping ${venue.name} - already has Place ID`);
          results.skipped++;
          venueResult.success = true;
          venueResult.placeId = venue.googlePlaceId || venue['Google Place ID'] || venue.google_place_id;
          venueResult.error = 'Already has Place ID';
          results.venues.push(venueResult);
          continue;
        }

        // Find Place ID
        const placeId = await this.placeFinder.findPlaceId(venue.name, venue.address);
        
        if (placeId) {
          // Verify the place details
          const placeDetails = await this.placeFinder.getPlaceDetails(placeId);
          
          if (placeDetails) {
            console.log(`📝 Place Details: ${placeDetails.name} - ${placeDetails.formatted_address}`);
            console.log(`⭐ Rating: ${placeDetails.rating || 'N/A'} (${placeDetails.user_ratings_total || 0} reviews)`);
            
            // Update the venue
            const success = await this.updateVenueWithPlaceId(venue.id, placeId);
            
            if (success) {
              results.updated++;
              venueResult.success = true;
              venueResult.placeId = placeId;
              venueResult.placeDetails = placeDetails;
            } else {
              results.failed++;
              venueResult.error = 'Update failed';
              results.errors.push(`${venue.name}: Update failed`);
            }
          } else {
            console.log(`❌ Could not verify place details for ${venue.name}`);
            results.failed++;
            venueResult.error = 'Could not verify place details';
            results.errors.push(`${venue.name}: Could not verify place details`);
          }
        } else {
          results.failed++;
          venueResult.error = 'No Place ID found';
          results.errors.push(`${venue.name}: No Place ID found`);
        }

        results.venues.push(venueResult);

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Print summary
      console.log('\n📊 TEST COMPLETE');
      console.log('================');
      console.log(`Total venues: ${results.total}`);
      console.log(`Updated: ${results.updated}`);
      console.log(`Skipped: ${results.skipped}`);
      console.log(`Failed: ${results.failed}`);
      
      if (results.errors.length > 0) {
        console.log('\n❌ ERRORS:');
        results.errors.forEach(error => console.log(`  - ${error}`));
      }

      return results;
    } catch (error) {
      console.error('❌ Error in processTestVenues:', error);
      throw error;
    }
  }
}

exports.handler = async function(event, context) {
  try {
    console.log('🧪 Testing Google Place ID creation for multiple venues');

    const tester = new MultipleVenueTester();
    const result = await tester.processTestVenues();

    return {
      statusCode: result.failed === 0 ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}; 