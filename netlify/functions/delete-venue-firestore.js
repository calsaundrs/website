const admin = require('firebase-admin');
const { verifyAuth } = require('./utils/auth');

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

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🗑️ Delete venue function called');

    // Verify authentication
    try {
        await verifyAuth(event);
    } catch (authError) {
        return {
            statusCode: authError.statusCode || 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: authError.message })
        };
    }
    
    // Parse the request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { venueId } = requestBody;
    
    if (!venueId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Venue ID is required' })
      };
    }

    console.log(`🗑️ Deleting venue with ID: ${venueId}`);

    // Check if venue exists
    const venueRef = db.collection('venues').doc(venueId);
    const venueDoc = await venueRef.get();

    if (!venueDoc.exists) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Venue not found' })
      };
    }

    // Get venue data for logging
    const venueData = venueDoc.data();
    console.log(`🗑️ Found venue: ${venueData.name || 'Unknown'}`);

    // Delete the venue
    await venueRef.delete();
    
    console.log(`✅ Venue deleted successfully: ${venueId}`);

    // Trigger SSG rebuild for venue pages
    let ssgRebuildResult = null;
    try {
      console.log('Venue deleted - triggering build hook...');
      const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
      if (buildHookUrl) {
        const response = await fetch(buildHookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        if (response.ok) {
          const buildId = await response.text();
          ssgRebuildResult = { success: true, message: 'Build triggered successfully', buildId: buildId };
          console.log('Build hook triggered successfully:', buildId);
        } else {
          throw new Error(`Build hook failed: ${response.status} ${response.statusText}`);
        }
      } else {
        console.log('NETLIFY_BUILD_HOOK_URL not configured - skipping build trigger');
        ssgRebuildResult = { success: false, message: 'Build hook not configured' };
      }
    } catch (error) {
      console.error('Error triggering build hook:', error);
      ssgRebuildResult = { success: false, message: error.message };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Venue deleted successfully',
        venueId: venueId,
        venueName: venueData.name || 'Unknown',
        ssgRebuild: ssgRebuildResult
      })
    };

  } catch (error) {
    console.error('❌ Error deleting venue:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to delete venue',
        message: error.message
      })
    };
  }
};
