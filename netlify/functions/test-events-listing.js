const admin = require('firebase-admin');

exports.handler = async (event, context) => {
  try {
    console.log('Testing events listing...');
    
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
    
    // Get a few events
    const eventsRef = db.collection('events');
    const snapshot = await eventsRef
      .where('status', '==', 'approved')
      .limit(5)
      .get();
    
    const testEvents = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      testEvents.push({
        id: doc.id,
        name: data.name || 'Untitled Event',
        slug: data.slug || '',
        date: data.date,
        // Raw image data
        rawImageData: {
          cloudinaryPublicId: data.cloudinaryPublicId,
          'Cloudinary Public ID': data['Cloudinary Public ID'],
          promoImage: data.promoImage,
          'Promo Image': data['Promo Image'],
          image: data.image,
          imageUrl: data.imageUrl
        },
        // All keys for debugging
        allKeys: Object.keys(data),
        // Image-related keys
        imageKeys: Object.keys(data).filter(key => 
          key.toLowerCase().includes('image') || 
          key.toLowerCase().includes('promo') || 
          key.toLowerCase().includes('cloudinary')
        )
      });
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
        message: 'Events listing test completed',
        eventCount: testEvents.length,
        events: testEvents,
        cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Events listing test failed:', error);
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