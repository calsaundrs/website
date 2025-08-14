/**
 * Netlify Function: Test Google Place ID Creation
 * 
 * This function tests the Google Place ID creation process on a single venue
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

class SingleVenueTester {
  constructor() {
    this.placeFinder = new GooglePlaceIdFinder();
  }

  /**
   * Get a single venue from Firestore by name
   * @param {string} venueName - Name of the venue to find
   * @returns {Promise<Object|null>} - Venue document or null if not found
   */
  async getVenueByName(venueName) {
    try {
      const venuesRef = db.collection('venues');
      const snapshot = await venuesRef.where('name', '==', venueName).get();
      
      if (snapshot.empty) {
        console.log(`❌ No venue found with name: ${venueName}`);
        return null;
      }
      
      const venue = snapshot.docs[0];
      console.log(`📋 Found venue: ${venue.data().name} (ID: ${venue.id})`);
      console.log(`📍 Address: ${venue.data().address}`);
      console.log(`🆔 Current Google Place ID: ${venue.data().googlePlaceId || 'None'}`);
      
      return {
        id: venue.id,
        ...venue.data()
      };
    } catch (error) {
      console.error('❌ Error fetching venue:', error);
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
   * Test the Google Place ID process on a single venue
   * @param {string} venueName - Name of the venue to test
   */
  async testSingleVenue(venueName = 'The Nightingale Club') {
    try {
      console.log('🧪 Starting single venue Google Place ID test...\n');
      console.log(`🎯 Testing venue: ${venueName}\n`);
      
      // Get the venue
      const venue = await this.getVenueByName(venueName);
      
      if (!venue) {
        console.log('❌ Test failed: Venue not found');
        return { success: false, error: 'Venue not found' };
      }

      // Check if already has a Place ID
      if (venue.googlePlaceId || venue['Google Place ID'] || venue.google_place_id) {
        console.log(`⏭️  Venue already has Place ID: ${venue.googlePlaceId || venue['Google Place ID'] || venue.google_place_id}`);
        return { 
          success: true, 
          message: 'Venue already has Place ID',
          venue: venue,
          placeId: venue.googlePlaceId || venue['Google Place ID'] || venue.google_place_id
        };
      }

      console.log('\n🔍 STEP 1: Finding Google Place ID...');
      const placeId = await this.placeFinder.findPlaceId(venue.name, venue.address);
      
      if (!placeId) {
        console.log('❌ Test failed: Could not find Place ID');
        return { success: false, error: 'Could not find Place ID' };
      }

      console.log('\n🔍 STEP 2: Getting place details...');
      const placeDetails = await this.placeFinder.getPlaceDetails(placeId);
      
      if (!placeDetails) {
        console.log('❌ Test failed: Could not get place details');
        return { success: false, error: 'Could not get place details' };
      }

      console.log('\n📝 PLACE DETAILS:');
      console.log(`   Name: ${placeDetails.name}`);
      console.log(`   Address: ${placeDetails.formatted_address}`);
      console.log(`   Rating: ${placeDetails.rating || 'N/A'} (${placeDetails.user_ratings_total || 0} reviews)`);
      console.log(`   Phone: ${placeDetails.formatted_phone_number || 'N/A'}`);
      console.log(`   Website: ${placeDetails.website || 'N/A'}`);
      
      if (placeDetails.opening_hours) {
        console.log(`   Open Now: ${placeDetails.opening_hours.open_now ? 'Yes' : 'No'}`);
      }

      console.log('\n💾 STEP 3: Updating venue in Firestore...');
      const success = await this.updateVenueWithPlaceId(venue.id, placeId);
      
      if (success) {
        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
        return {
          success: true,
          venue: venue,
          placeId: placeId,
          placeDetails: placeDetails,
          message: 'Venue updated successfully'
        };
      } else {
        console.log('\n❌ TEST FAILED: Could not update venue in Firestore');
        return { success: false, error: 'Could not update venue in Firestore' };
      }
    } catch (error) {
      console.error('❌ Test failed with error:', error);
      return { success: false, error: error.message };
    }
  }
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { url } = JSON.parse(event.body);
    
    function extractGooglePlaceId(input) {
      if (!input || typeof input !== 'string') return null;
      
      if (input.startsWith('ChIJ') || input.startsWith('0x')) {
        return input;
      }
      
      const urlPatterns = [
        /\/place\/[^\/]+\/([^\/\?]+)/,
        /\/maps\/place\/[^\/]+\/([^\/\?]+)/,
        /[?&]cid=([^&]+)/,
        /[?&]place_id=([^&]+)/,
        /!1s([^!]+)!/,
      ];
      
      for (const pattern of urlPatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
          const placeId = match[1];
          if (placeId.startsWith('ChIJ') || placeId.startsWith('0x')) {
            return placeId;
          }
        }
      }
      
      return input;
    }

    const extractedPlaceId = extractGooglePlaceId(url);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        originalUrl: url,
        extractedPlaceId: extractedPlaceId,
        isValid: extractedPlaceId && (extractedPlaceId.startsWith('ChIJ') || extractedPlaceId.startsWith('0x'))
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to extract Place ID',
        message: error.message
      })
    };
  }
}; 