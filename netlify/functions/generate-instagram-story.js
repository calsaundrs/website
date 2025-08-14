const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
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

exports.handler = async (event, context) => {
    console.log("=== GENERATE INSTAGRAM STORY FUNCTION CALLED ===");
    
    try {
        // Parse request
        const { eventId, eventSlug } = JSON.parse(event.body || '{}');
        
        if (!eventId && !eventSlug) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing eventId or eventSlug parameter'
                })
            };
        }
        
        // Fetch event data
        let eventData = null;
        if (eventId) {
            const eventDoc = await db.collection('events').doc(eventId).get();
            if (eventDoc.exists) {
                eventData = { id: eventDoc.id, ...eventDoc.data() };
            }
        } else if (eventSlug) {
            const eventsRef = db.collection('events');
            const query = eventsRef.where('slug', '==', eventSlug);
            const snapshot = await query.get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                eventData = { id: doc.id, ...doc.data() };
            }
        }
        
        if (!eventData) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Event not found'
                })
            };
        }
        
        console.log(`Generating Instagram story for event: ${eventData['Event Name'] || eventData.name}`);
        
        // Generate Instagram story HTML
        const storyHtml = generateStoryHtml(eventData);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=3600'
            },
            body: storyHtml
        };
        
    } catch (error) {
        console.error('Error generating Instagram story:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to generate Instagram story',
                message: error.message
            })
        };
    }
};

function generateStoryHtml(eventData) {
    // Extract event data
    const eventName = eventData['Event Name'] || eventData.name || 'Event';
    const eventDate = eventData['Date'] || eventData.date;
    const eventTime = eventData['Time'] || eventData.time || eventData.startTime;
    const venueName = eventData['Venue Name'] || eventData.venueName || 'Venue TBC';
    const eventImage = eventData.image?.url || eventData.promoImage || null;
    const categories = eventData.category || eventData.categories || [];
    
    // Format date
    let formattedDate = '';
    if (eventDate) {
        const date = new Date(eventDate);
        formattedDate = date.toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        }).toUpperCase();
    }
    
    // Format time
    let formattedTime = '';
    if (eventTime) {
        if (typeof eventTime === 'string') {
            formattedTime = eventTime;
        } else if (eventTime instanceof Date) {
            formattedTime = eventTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
    }
    
    // Categories text
    const categoryText = categories.slice(0, 3).join(' • ');
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instagram Story - ${eventName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            width: 1080px;
            height: 1920px;
            background: #000000;
            font-family: 'Poppins', sans-serif;
            overflow: hidden;
        }
        
        .story-container {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .background-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
        }
        
        .background-gradient {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.1) 100%);
        }
        
        .fallback-gradient {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #1f2937 0%, #8B5CF6 50%, #E83A99 100%);
        }
        
        .header {
            position: relative;
            z-index: 10;
            text-align: center;
            padding: 60px 40px 20px;
        }
        
        .brand-title {
            font-family: 'Anton', sans-serif;
            font-size: 80px;
            font-weight: bold;
            background: linear-gradient(135deg, #FFFFFF 0%, #E83A99 50%, #8B5CF6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 0;
            line-height: 1;
            letter-spacing: 0.05em;
        }
        
        .brand-subtitle {
            font-size: 24px;
            color: rgba(255, 255, 255, 0.8);
            margin: 10px 0 0 0;
            font-weight: 500;
            letter-spacing: 0.05em;
        }
        
        .date-time {
            position: relative;
            z-index: 10;
            text-align: center;
            padding: 40px;
            display: flex;
            justify-content: center;
            gap: 60px;
        }
        
        .date, .time {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .date-icon, .time-icon {
            width: 30px;
            height: 30px;
            background: #E83A99;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
        }
        
        .date-text {
            font-size: 28px;
            color: white;
            font-weight: bold;
        }
        
        .time-text {
            font-size: 28px;
            color: #E83A99;
            font-weight: bold;
        }
        
        .content {
            position: relative;
            z-index: 10;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: 60px 40px;
        }
        
        .event-name {
            font-family: 'Anton', sans-serif;
            font-size: 60px;
            color: white;
            margin: 0 0 30px 0;
            line-height: 1.1;
            letter-spacing: 0.05em;
            text-align: center;
        }
        
        .venue {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .venue-icon {
            width: 25px;
            height: 25px;
            background: #E83A99;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
        }
        
        .venue-name {
            font-size: 32px;
            color: white;
            font-weight: bold;
        }
        
        .categories {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .category-text {
            font-size: 20px;
            color: #E83A99;
            font-weight: bold;
        }
        
        .call-to-action {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .view-details {
            display: flex;
            align-items: center;
            gap: 10px;
            color: white;
            font-size: 24px;
            font-weight: bold;
        }
        
        .arrow-icon {
            width: 20px;
            height: 20px;
            background: #E83A99;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
        }
        
        .website {
            font-size: 18px;
            color: #E83A99;
            font-weight: bold;
            letter-spacing: 0.05em;
        }
        
        .bottom-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 8px;
            background: linear-gradient(90deg, #E83A99 0%, #8B5CF6 100%);
        }
    </style>
</head>
<body>
    <div class="story-container">
        ${eventImage ? 
            `<img src="${eventImage}" alt="${eventName}" class="background-image">` : 
            '<div class="fallback-gradient"></div>'
        }
        <div class="background-gradient"></div>
        
        <div class="header">
            <h1 class="brand-title">BRUM OUTLOUD</h1>
            <p class="brand-subtitle">LGBTQ+ EVENTS IN BIRMINGHAM</p>
        </div>
        
        <div class="date-time">
            ${formattedDate ? `
                <div class="date">
                    <div class="date-icon">📅</div>
                    <div class="date-text">${formattedDate}</div>
                </div>
            ` : ''}
            ${formattedTime ? `
                <div class="time">
                    <div class="time-icon">🕐</div>
                    <div class="time-text">${formattedTime}</div>
                </div>
            ` : ''}
        </div>
        
        <div class="content">
            <h2 class="event-name">${eventName.toUpperCase()}</h2>
            
            <div class="venue">
                <div class="venue-icon">📍</div>
                <div class="venue-name">${venueName}</div>
            </div>
            
            ${categoryText ? `
                <div class="categories">
                    <div class="category-text">${categoryText}</div>
                </div>
            ` : ''}
            
            <div class="call-to-action">
                <div class="view-details">
                    <div class="arrow-icon">→</div>
                    <span>VIEW DETAILS</span>
                </div>
                <div class="website">BRUMOUTLOUD.CO.UK</div>
            </div>
        </div>
        
        <div class="bottom-bar"></div>
    </div>
</body>
</html>
    `;
}
