const admin = require('firebase-admin');

exports.handler = async (event, context) => {
  try {
    console.log('Fixing recurring events data structure...');
    
    // Initialize Firebase if not already done
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
    
    // Get all events
    const eventsRef = db.collection('events');
    const snapshot = await eventsRef
      .where('status', '==', 'approved')
      .get();
    
    const updates = [];
    const seriesGroups = new Map();
    
    // First pass: identify series groups
    snapshot.forEach(doc => {
      const data = doc.data();
      const seriesId = data.seriesId || data['Series ID'];
      
      if (seriesId) {
        if (!seriesGroups.has(seriesId)) {
          seriesGroups.set(seriesId, []);
        }
        seriesGroups.get(seriesId).push({ id: doc.id, data });
      }
    });
    
    console.log(`Found ${seriesGroups.size} series groups`);
    
    // Second pass: fix each event
    snapshot.forEach(doc => {
      const data = doc.data();
      const updates = {};
      let needsUpdate = false;
      
      // Fix field names (Airtable to Firestore)
      if (data['Event Name'] && !data.name) {
        updates.name = data['Event Name'];
        needsUpdate = true;
      }
      
      if (data['Description'] && !data.description) {
        updates.description = data['Description'];
        needsUpdate = true;
      }
      
      if (data['Date'] && !data.date) {
        updates.date = data['Date'];
        needsUpdate = true;
      }
      
      if (data['Venue Name'] && !data.venueName) {
        updates.venueName = data['Venue Name'];
        needsUpdate = true;
      }
      
      if (data['Venue Slug'] && !data.venueSlug) {
        updates.venueSlug = data['Venue Slug'];
        needsUpdate = true;
      }
      
      // Fix recurring fields
      const seriesId = data.seriesId || data['Series ID'];
      if (seriesId) {
        updates.seriesId = seriesId;
        updates.isRecurring = true;
        updates.recurringGroupId = seriesId;
        
        // Determine recurring pattern
        let pattern = null;
        if (data.recurringPattern) {
          pattern = data.recurringPattern;
        } else if (data.recurringInfo) {
          pattern = extractRecurringPattern(data.recurringInfo);
        } else if (data['Recurring Info']) {
          pattern = extractRecurringPattern(data['Recurring Info']);
        }
        
        if (pattern) {
          updates.recurringPattern = pattern;
        }
        
        // Find pattern from series group
        const seriesGroup = seriesGroups.get(seriesId);
        if (seriesGroup && seriesGroup.length > 1) {
          updates.totalInstances = seriesGroup.length;
          updates.recurringInstance = seriesGroup.findIndex(item => item.id === doc.id) + 1;
        }
        
        needsUpdate = true;
      }
      
      // Add missing fields
      if (!data.slug) {
        updates.slug = generateSlug(data.name || data['Event Name'] || 'untitled-event');
        needsUpdate = true;
      }
      
      if (!data.createdAt) {
        updates.createdAt = new Date();
        needsUpdate = true;
      }
      
      if (!data.updatedAt) {
        updates.updatedAt = new Date();
        needsUpdate = true;
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        updates.updatedAt = new Date();
        db.collection('events').doc(doc.id).update(updates);
        console.log(`Updated event ${doc.id}: ${Object.keys(updates).join(', ')}`);
      }
    });

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
        message: 'Recurring events data structure fixed',
        seriesGroups: seriesGroups.size,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Fix recurring events failed:', error);
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

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractRecurringPattern(recurringInfo) {
  if (!recurringInfo) return null;
  
  const text = recurringInfo.toLowerCase();
  if (text.includes('weekly') || text.includes('every week')) {
    return 'weekly';
  } else if (text.includes('monthly') || text.includes('every month')) {
    return 'monthly';
  } else if (text.includes('daily') || text.includes('every day')) {
    return 'daily';
  } else if (text.includes('bi-weekly') || text.includes('every two weeks')) {
    return 'bi-weekly';
  } else if (text.includes('yearly') || text.includes('annual')) {
    return 'yearly';
  } else {
    return 'recurring';
  }
} 