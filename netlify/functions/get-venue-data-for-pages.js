const admin = require('firebase-admin');

exports.handler = async function (event, context) {
    console.log('Get venue data for pages function called');
    
    try {
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];
        
        const missing = required.filter(varName => !process.env[varName]);
        if (missing.length > 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Environment configuration error',
                    message: `Missing environment variables: ${missing.join(', ')}`,
                    missing: missing
                })
            };
        }
        
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
        
        console.log('Firebase initialized successfully');
        
        // Get all venues from Firestore
        console.log('Fetching all venues from database...');
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.get();
        
        console.log(`Found ${snapshot.size} venues in database`);
        
        const venues = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const venue = {
                id: doc.id,
                name: data.name || data['Name'] || 'Untitled Venue',
                slug: data.slug || data['Slug'] || generateSlug(data.name || data['Name'] || 'venue'),
                description: data.description || data['Description'] || '',
                address: data.address || data['Address'] || '',
                status: data.status || 'pending',
                image: data.image || data['Image'] || null,
                website: data.website || data['Website'] || '',
                contactPhone: data.contactPhone || data['Contact Phone'] || '',
                openingHours: data.openingHours || data['Opening Hours'] || '',
                accessibility: data.accessibility || data['Accessibility'] || '',
                features: data.features || data['Features'] || [],
                socialMedia: data.socialMedia || data['Social Media'] || {},
                tags: data.tags || data['Tags'] || []
            };
            
            venues.push(venue);
        });
        
        // Generate slug function
        function generateSlug(name) {
            return (name || 'venue').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
        
        // Create a simple venue page template
        const venuePageTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VENUE_NAME - LGBTQ+ Venue in Birmingham | Brum Outloud</title>
    <meta name="description" content="VENUE_DESCRIPTION">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
</head>
<body class="antialiased">
    <div class="bg-yellow-500 text-black text-center p-2 text-sm font-semibold">
        <p>Please note: This website is in active development. Things may break unexpectedly. Thank you for your patience!</p>
    </div>

    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a href="/events.html" class="text-gray-300 hover:text-white">WHAT'S ON</a>
                <a href="/all-venues.html" class="text-gray-300 hover:text-white">VENUES</a>
                <a href="/community.html" class="text-gray-300 hover:text-white">COMMUNITY</a>
                <a href="/contact.html" class="text-gray-300 hover:text-white">CONTACT</a>
                <a href="https://brumoutloud.co.uk/promoter-submit-new" class="inline-block bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">GET LISTED</a>
            </div>
        </nav>
    </header>

    <main class="container mx-auto px-4 py-12">
        <div class="max-w-4xl mx-auto">
            <nav class="mb-8">
                <a href="/all-venues.html" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Venues
                </a>
            </nav>
            
            <div class="venue-card rounded-xl overflow-hidden mb-8">
                <div class="aspect-2-1 bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center overflow-hidden">
                    VENUE_IMAGE_HTML
                </div>
                <div class="p-8">
                    <h1 class="text-4xl font-bold text-white mb-4">VENUE_NAME</h1>
                    VENUE_ADDRESS_HTML
                    VENUE_DESCRIPTION_HTML
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="venue-card p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">Contact Information</h2>
                    <div class="space-y-3">
                        VENUE_CONTACT_HTML
                    </div>
                </div>
                
                <div class="venue-card p-6">
                    <h2 class="text-2xl font-bold text-white mb-4">Features & Accessibility</h2>
                    <div class="space-y-3">
                        VENUE_FEATURES_HTML
                    </div>
                </div>
            </div>
            
            VENUE_SOCIAL_HTML
        </div>
    </main>
    
    <footer class="border-t-2 border-gray-800 p-8">
        <div class="container mx-auto grid md:grid-cols-2">
            <div>
                <h3 class="font-anton text-5xl leading-tight text-white">BE SEEN,<br>BE HEARD.</h3>
                <div class="flex space-x-6 text-2xl mt-6 text-gray-400">
                    <a href="https://www.instagram.com/brumoutloud/" target="_blank" rel="noopener noreferrer" class="hover:text-pink-400 transition-colors"><i class="fab fa-instagram"></i></a>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-8 mt-8 md:mt-0">
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">Explore</h4>
                    <ul>
                        <li class="mb-2"><a href="/events.html" class="text-gray-400 hover:text-white transition-colors">Events</a></li>
                        <li class="mb-2"><a href="/all-venues.html" class="text-gray-400 hover:text-white transition-colors">Venues</a></li>
                        <li class="mb-2"><a href="/promoter-tool" class="text-gray-400 hover:text-white transition-colors">Promoter Tools</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">About</h4>
                    <ul>
                        <li class="mb-2"><a href="/community.html" class="text-gray-400 hover:text-white transition-colors">Community & FAQ</a></li>
                        <li class="mb-2"><a href="/contact" class="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
</body>
</html>`;
        
        console.log(`Successfully processed ${venues.length} venues for page generation`);
        
        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600'
            },
            body: JSON.stringify({
                success: true,
                message: 'Venue data ready for page generation',
                totalVenues: venues.length,
                venues: venues,
                template: venuePageTemplate,
                generatedAt: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Get venue data for pages failed:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Get venue data for pages failed',
                message: error.message,
                type: error.constructor.name,
                stack: error.stack
            })
        };
    }
};