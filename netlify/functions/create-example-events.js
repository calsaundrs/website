const admin = require('firebase-admin');

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

exports.handler = async function (event, context) {
    console.log('🎭 Creating example events for Social Reels Generator testing');
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const now = new Date();
        const exampleEvents = [
            {
                name: 'Queer Comedy Night',
                description: 'Join us for an evening of laughter with Birmingham\'s funniest LGBTQ+ comedians. Stand-up, sketches, and community vibes!',
                date: new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)), // 2 days from now
                status: 'approved',
                venueName: 'The Nightingale Club',
                venueAddress: '1 Kent Street, Birmingham B5 6RD',
                venueId: 'nightingale-club-123',
                venueSlug: 'the-nightingale-club',
                category: ['Comedy', 'Entertainment'],
                slug: 'queer-comedy-night-' + Date.now(),
                cloudinaryPublicId: 'sample-comedy-event',
                submittedBy: 'admin@brumoutloud.com',
                createdAt: new Date(),
                priceInfo: '£8 advance / £10 door',
                ageRestriction: '18+'
            },
            {
                name: 'Pride Karaoke',
                description: 'Sing your heart out at our weekly Pride Karaoke! All voices welcome in this supportive, fabulous environment.',
                date: new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000)), // 5 days from now
                status: 'approved',
                venueName: 'Eden Bar',
                venueAddress: '12-16 Newhall Street, Birmingham B3 3LX',
                venueId: 'eden-bar-456',
                venueSlug: 'eden-bar',
                category: ['Karaoke', 'Music', 'Social'],
                slug: 'pride-karaoke-' + Date.now(),
                cloudinaryPublicId: 'sample-karaoke-event',
                submittedBy: 'admin@brumoutloud.com',
                createdAt: new Date(),
                priceInfo: 'Free entry',
                ageRestriction: '18+'
            },
            {
                name: 'Drag Bingo Extravaganza',
                description: 'Get ready for the most fabulous bingo night in Birmingham! Prizes, performances, and plenty of laughs.',
                date: new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)), // 1 week from now
                status: 'approved',
                venueName: 'The Village Inn',
                venueAddress: '46 Lower Essex Street, Birmingham B5 6SN',
                venueId: 'village-inn-789',
                venueSlug: 'the-village-inn',
                category: ['Drag', 'Bingo', 'Entertainment'],
                slug: 'drag-bingo-extravaganza-' + Date.now(),
                cloudinaryPublicId: 'sample-drag-event',
                submittedBy: 'admin@brumoutloud.com',
                createdAt: new Date(),
                priceInfo: '£12 including bingo cards',
                ageRestriction: '18+'
            },
            {
                name: 'Trans* Support Group Meeting',
                description: 'Monthly peer support group for trans and non-binary people. Safe space, confidential, and welcoming.',
                date: new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)), // 2 weeks from now
                status: 'approved',
                venueName: 'MAC (Midlands Art Centre)',
                venueAddress: 'Cannon Hill Park, Birmingham B12 9QH',
                venueId: 'mac-centre-101',
                venueSlug: 'mac-midlands-art-centre',
                category: ['Support Group', 'Trans', 'Community'],
                slug: 'trans-support-group-' + Date.now(),
                cloudinaryPublicId: 'sample-support-event',
                submittedBy: 'admin@brumoutloud.com',
                createdAt: new Date(),
                priceInfo: 'Free',
                ageRestriction: 'All ages welcome'
            },
            {
                name: 'Rainbow Book Club',
                description: 'Monthly LGBTQ+ book club discussing queer literature, memoirs, and contemporary fiction.',
                date: new Date(now.getTime() + (21 * 24 * 60 * 60 * 1000)), // 3 weeks from now
                status: 'approved',
                venueName: 'The Fox',
                venueAddress: '27 Lower Essex Street, Birmingham B5 6SN',
                venueId: 'the-fox-202',
                venueSlug: 'the-fox',
                category: ['Books', 'Literature', 'Social'],
                slug: 'rainbow-book-club-' + Date.now(),
                cloudinaryPublicId: 'sample-book-event',
                submittedBy: 'admin@brumoutloud.com',
                createdAt: new Date(),
                priceInfo: 'Free (buy your own drinks)',
                ageRestriction: '18+'
            },
            {
                name: 'Pride Party Dance Night',
                description: 'Dance the night away with the best in pop, house, and LGBTQ+ anthems. Multiple rooms, multiple vibes!',
                date: new Date(now.getTime() + (28 * 24 * 60 * 60 * 1000)), // 4 weeks from now
                status: 'approved',
                venueName: 'Missing Bar',
                venueAddress: '8 John Bright Street, Birmingham B1 1BN',
                venueId: 'missing-bar-303',
                venueSlug: 'missing-bar',
                category: ['Dance', 'Party', 'Music'],
                slug: 'pride-party-dance-night-' + Date.now(),
                cloudinaryPublicId: 'sample-dance-event',
                submittedBy: 'admin@brumoutloud.com',
                createdAt: new Date(),
                priceInfo: '£15 advance / £20 door',
                ageRestriction: '18+'
            }
        ];

        console.log(`📝 Creating ${exampleEvents.length} example events...`);

        const batch = db.batch();
        const createdEvents = [];

        exampleEvents.forEach(eventData => {
            const docRef = db.collection('events').doc();
            batch.set(docRef, eventData);
            createdEvents.push({
                id: docRef.id,
                ...eventData,
                date: eventData.date.toISOString()
            });
        });

        await batch.commit();

        console.log('✅ Example events created successfully');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                message: `Created ${exampleEvents.length} example events for testing`,
                events: createdEvents,
                dateRange: {
                    earliest: createdEvents[0].date,
                    latest: createdEvents[createdEvents.length - 1].date
                }
            })
        };

    } catch (error) {
        console.error('❌ Error creating example events:', error);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: 'Failed to create example events',
                message: error.message
            })
        };
    }
}; 