const admin = require('firebase-admin');

exports.handler = async (event, context) => {
  try {
    console.log('Debugging recurring events...');
    
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
    
    const allEvents = [];
    const recurringEvents = [];
    const standaloneEvents = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const event = {
        id: doc.id,
        name: data.name || 'Untitled Event',
        date: data.date,
        // Recurring fields
        isRecurring: data.isRecurring || false,
        recurringInfo: data.recurringInfo || null,
        recurringPattern: data.recurringPattern || null,
        recurringGroupId: data.recurringGroupId || null,
        recurringInstance: data.recurringInstance || null,
        totalInstances: data.totalInstances || null,
        recurringStartDate: data.recurringStartDate || null,
        recurringEndDate: data.recurringEndDate || null,
        // Legacy fields
        seriesId: data.seriesId || null,
        'Series ID': data['Series ID'] || null,
        'Recurring Info': data['Recurring Info'] || null,
        // All keys for debugging
        allKeys: Object.keys(data)
      };
      
      allEvents.push(event);
      
      // Categorize events - check for any recurring indicators
      const hasRecurringFields = event.isRecurring || 
                                event.recurringInfo || 
                                event.recurringPattern || 
                                event.recurringGroupId || 
                                event.seriesId || 
                                event['Series ID'] || 
                                event['Recurring Info'] ||
                                (event.allKeys && event.allKeys.some(key => 
                                  key.toLowerCase().includes('recurring') || 
                                  key.toLowerCase().includes('series')
                                ));
      
      if (hasRecurringFields) {
        recurringEvents.push(event);
      } else {
        standaloneEvents.push(event);
      }
    });

    // Group recurring events by series ID or pattern
    const recurringGroups = new Map();
    recurringEvents.forEach(event => {
      // Try to group by Series ID first
      const seriesId = event.seriesId || event['Series ID'];
      const pattern = event.recurringPattern || 
                     extractRecurringPattern(event.recurringInfo) || 
                     extractRecurringPattern(event['Recurring Info']) || 
                     'unknown';
      
      const groupKey = seriesId || pattern;
      
      if (!recurringGroups.has(groupKey)) {
        recurringGroups.set(groupKey, []);
      }
      recurringGroups.get(groupKey).push(event);
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
        message: 'Recurring events debug completed',
        summary: {
          totalEvents: allEvents.length,
          recurringEvents: recurringEvents.length,
          standaloneEvents: standaloneEvents.length,
          recurringPatterns: Array.from(recurringGroups.keys())
        },
        recurringGroups: Object.fromEntries(recurringGroups),
        sampleRecurringEvents: recurringEvents.slice(0, 5),
        sampleStandaloneEvents: standaloneEvents.slice(0, 5),
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Recurring events debug failed:', error);
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