const Airtable = require('airtable');
const admin = require('firebase-admin');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async (event, context) => {
  try {
    console.log('Starting simple event image migration...');
    
    // Initialize Firebase
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    }
    const db = admin.firestore();
    
    // Get only approved events from Airtable with image data
    const airtableRecords = await base('Events').select({
      filterByFormula: '{Status} = "Approved"',
      fields: [
        'Event Name', 'Slug', 'Date', 'Status', 'Promo Image', 'Cloudinary Public ID'
      ],
      maxRecords: 100 // Limit to prevent timeout
    }).firstPage();

    console.log(`Found ${airtableRecords.length} approved events in Airtable`);

    // Get only approved events from Firestore
    const firestoreSnapshot = await db.collection('events')
      .where('status', '==', 'approved')
      .limit(100)
      .get();
    
    const firestoreEvents = {};
    
    firestoreSnapshot.forEach(doc => {
      const data = doc.data();
      const key = data.slug || data.name;
      firestoreEvents[key] = {
        id: doc.id,
        data: data
      };
    });

    console.log(`Found ${Object.keys(firestoreEvents).length} approved events in Firestore`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each Airtable record
    for (const record of airtableRecords) {
      try {
        const fields = record.fields;
        const eventName = fields['Event Name'];
        const slug = fields['Slug'];
        const promoImage = fields['Promo Image'];
        const cloudinaryPublicId = fields['Cloudinary Public ID'];

        // Skip if no image data
        if (!promoImage && !cloudinaryPublicId) {
          console.log(`Skipping ${eventName} - no image data`);
          skippedCount++;
          continue;
        }

        // Find matching Firestore event
        const firestoreKey = slug || eventName;
        const firestoreEvent = firestoreEvents[firestoreKey];

        if (!firestoreEvent) {
          console.log(`No Firestore event found for ${eventName} (${firestoreKey})`);
          skippedCount++;
          continue;
        }

        // Prepare image data to add to Firestore
        const imageUpdates = {};

        if (cloudinaryPublicId) {
          imageUpdates['Cloudinary Public ID'] = cloudinaryPublicId;
        }

        if (promoImage && promoImage.length > 0) {
          imageUpdates['Promo Image'] = promoImage;
        }

        // Update Firestore document
        await db.collection('events').doc(firestoreEvent.id).update(imageUpdates);
        
        console.log(`Updated ${eventName} with image data`);
        updatedCount++;

      } catch (error) {
        console.error(`Error processing ${record.fields['Event Name']}:`, error);
        errorCount++;
      }
    }

    console.log('Migration completed');
    console.log(`Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: true,
        message: 'Simple event image migration completed',
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        totalProcessed: airtableRecords.length
      })
    };

  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
}; 