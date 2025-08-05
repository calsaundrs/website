/**
 * Google Place IDs Creation Script
 * 
 * This script fetches all venues from Firestore, finds their Google Place IDs
 * using the Google Places API, and updates the venue records with the Place IDs.
 * 
 * Usage: node create-google-place-ids.js
 */

const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin
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

if (!GOOGLE_PLACES_API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY environment variable is required');
  process.exit(1);
}

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
      const url = `${this.baseUrl}/details/json?place_id=${placeId}&fields=name,formatted_address,rating,user_ratings_total&key=${this.apiKey}`;
      
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

class VenueUpdater {
  constructor() {
    this.placeFinder = new GooglePlaceIdFinder();
  }

  /**
   * Get all venues from Firestore
   * @returns {Promise<Array>} - Array of venue documents
   */
  async getAllVenues() {
    try {
      const venuesRef = db.collection('venues');
      const snapshot = await venuesRef.get();
      
      const venues = [];
      snapshot.forEach(doc => {
        venues.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`📋 Found ${venues.length} venues in Firestore`);
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
      await db.collection('venues').doc(venueId).update({
        googlePlaceId: placeId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Updated venue ${venueId} with Place ID: ${placeId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating venue ${venueId}:`, error);
      return false;
    }
  }

  /**
   * Process all venues and add Google Place IDs
   */
  async processAllVenues() {
    try {
      console.log('🚀 Starting Google Place ID creation process...\n');
      
      const venues = await this.getAllVenues();
      const results = {
        total: venues.length,
        updated: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };

      for (const venue of venues) {
        console.log(`\n📍 Processing: ${venue.name}`);
        
        // Skip if already has a Place ID
        if (venue.googlePlaceId || venue['Google Place ID'] || venue.google_place_id) {
          console.log(`⏭️  Skipping ${venue.name} - already has Place ID`);
          results.skipped++;
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
            } else {
              results.failed++;
              results.errors.push(`${venue.name}: Update failed`);
            }
          } else {
            console.log(`❌ Could not verify place details for ${venue.name}`);
            results.failed++;
            results.errors.push(`${venue.name}: Could not verify place details`);
          }
        } else {
          results.failed++;
          results.errors.push(`${venue.name}: No Place ID found`);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Print summary
      console.log('\n📊 PROCESSING COMPLETE');
      console.log('========================');
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
      console.error('❌ Error in processAllVenues:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  try {
    const updater = new VenueUpdater();
    const results = await updater.processAllVenues();
    
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { GooglePlaceIdFinder, VenueUpdater }; 