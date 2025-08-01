const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

let firebaseInitialized = false;
let db = null;

// Initialize Firebase if credentials are available
try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                })
            });
        }
        firebaseInitialized = true;
        db = admin.firestore();
    }
} catch (error) {
    console.error('Firebase initialization failed:', error.message);
}

// Embedded venue template
const embeddedVenueTemplate = `<!DOCTYPE html>
<html lang="en" class="loaded">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{venue.name}} - BrumOutLoud</title>
    <meta name="description" content="{{venue.description}}">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{{venue.name}}">
    <meta property="og:description" content="{{venue.description}}">
    <meta property="og:type" content="business.business">
    <meta property="og:url" content="https://brumoutloud.co.uk/venue/{{venue.slug}}">
    <meta property="og:image" content="{{venue.imageUrl}}">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    
    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        body {
            background: linear-gradient(135deg, #111827 0%, #7C3AED 50%, #111827 100%);
            color: #EAEAEA;
            font-family: 'Poppins', sans-serif;
            min-height: 100vh;
        }
        .venue-card {
            background: rgba(17, 24, 39, 0.5);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(75, 85, 99, 0.2);
            transition: all 0.3s ease;
        }
        .accent-color { color: #E83A99; }
        .btn-primary {
            background: linear-gradient(135deg, #E83A99 0%, #8B5CF6 100%);
            border: 1px solid rgba(232, 58, 153, 0.3);
            transition: all 0.3s ease;
        }
        .btn-secondary {
            background: rgba(75, 85, 99, 0.3);
            border: 1px solid rgba(75, 85, 99, 0.5);
            transition: all 0.3s ease;
        }
    </style>
</head>
<body class="fouc-prevention bg-gray-900 text-white min-h-screen loaded">
    <!-- Header -->
    <header class="p-8">
        <nav class="container mx-auto flex justify-between items-center">
            <a href="/" class="flex items-center text-2xl tracking-widest text-white">
                <span>Brum Outloud</span>
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag" class="h-6 w-auto ml-2 inline-block rounded" loading="lazy">
            </a>
            <div class="hidden lg:flex items-center space-x-8">
                <a class='text-gray-300 hover:text-white' href='/events'>WHAT'S ON</a>
                <a class='text-gray-300 hover:text-white' href='/all-venues'>VENUES</a>
                <a class='text-gray-300 hover:text-white' href='/community'>COMMUNITY</a>
                <a class='text-gray-300 hover:text-white' href='/contact'>CONTACT</a>
                <a class='inline-block bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200' href='/promoter-tool'>GET LISTED</a>
            </div>
        </nav>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-8 py-8">
        <!-- Breadcrumb -->
        <nav class="mb-8">
            <ol class="flex items-center space-x-2 text-sm text-gray-400">
                <li><a href="/" class="hover:text-white transition-colors">Home</a></li>
                <li><span class="mx-2">/</span></li>
                <li><a href="/all-venues" class="hover:text-white transition-colors">Venues</a></li>
                <li><span class="mx-2">/</span></li>
                <li class="text-white">{{venue.name}}</li>
            </ol>
        </nav>

        <div class="venue-card rounded-xl overflow-hidden">
            <!-- Hero Image -->
            <div class="aspect-video bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center relative">
                {{#if venue.imageUrl}}
                <img src="{{venue.imageUrl}}" alt="{{venue.name}}" class="w-full h-full object-cover">
                {{else}}
                <i class="fas fa-building text-6xl text-gray-600"></i>
                {{/if}}
                <div class="absolute top-4 left-4">
                    <a href="/all-venues" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-arrow-left mr-1"></i>Back
                    </a>
                </div>
                <div class="absolute top-4 right-4">
                    <button onclick="shareVenue()" class="btn-secondary text-white px-3 py-1 rounded-lg text-sm">
                        <i class="fas fa-share mr-1"></i>Share
                    </button>
                </div>
            </div>
            
            <div class="p-8">
                <!-- Venue Header -->
                <div class="mb-8">
                    <h1 class="text-4xl font-bold text-white mb-4">{{venue.name}}</h1>
                    <p class="text-xl text-gray-300 mb-4">
                        <i class="fas fa-map-marker-alt mr-2 text-accent-color"></i>
                        {{venue.address}}
                    </p>
                    <div class="flex flex-wrap gap-2 mb-6">
                        {{#each venue.tags}}
                        <span class="inline-block bg-blue-100/20 text-blue-300 text-sm px-3 py-1 rounded-full">{{this}}</span>
                        {{/each}}
                    </div>
                </div>

                <!-- Venue Content -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Main Content -->
                    <div class="lg:col-span-2">
                        {{#if venue.description}}
                        <div class="venue-card p-6 mb-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-info-circle mr-3 text-accent-color"></i>About This Venue
                            </h2>
                            <div class="text-gray-300 leading-relaxed">
                                {{{venue.formattedDescription}}}
                            </div>
                        </div>
                        {{/if}}

                        {{#if venue.upcomingEvents}}
                        <!-- Upcoming Events -->
                        <div class="venue-card p-6">
                            <h2 class="text-2xl font-bold text-white mb-4">
                                <i class="fas fa-calendar mr-3 text-accent-color"></i>Upcoming Events
                            </h2>
                            <div class="space-y-4">
                                {{#each venue.upcomingEvents}}
                                <a href="/event/{{this.slug}}" class="venue-card p-4 flex items-center space-x-4 hover:bg-gray-800 transition-colors duration-200 block">
                                    <div class="text-center w-20 flex-shrink-0">
                                        <p class="text-2xl font-bold text-white">{{this.dayOfMonth}}</p>
                                        <p class="text-lg text-gray-400">{{this.monthAbbr}}</p>
                                    </div>
                                    <div class="flex-grow">
                                        <h4 class="font-bold text-white text-xl">{{this.name}}</h4>
                                        <p class="text-sm text-gray-400">{{this.time}}</p>
                                    </div>
                                    <div class="text-accent-color">
                                        <i class="fas fa-arrow-right"></i>
                                    </div>
                                </a>
                                {{/each}}
                            </div>
                        </div>
                        {{/if}}
                    </div>

                    <!-- Sidebar -->
                    <div class="space-y-6">
                        {{#if venue.website}}
                        <!-- Action Buttons -->
                        <div class="venue-card p-6">
                            <div class="space-y-3">
                                <a href="{{venue.website}}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold flex items-center justify-center">
                                    <i class="fas fa-external-link-alt mr-2"></i>Visit Website
                                </a>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Contact Info -->
                        {{#if venue.phone}}
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-phone mr-2 text-accent-color"></i>Contact Info
                            </h3>
                            <div class="space-y-3">
                                <div>
                                    <p class="text-gray-400 text-sm">Phone</p>
                                    <a href="tel:{{venue.phone}}" class="text-blue-400 hover:underline">
                                        {{venue.phone}}
                                    </a>
                                </div>
                            </div>
                        </div>
                        {{/if}}

                        <!-- Share Venue -->
                        <div class="venue-card p-6">
                            <h3 class="text-xl font-bold text-white mb-4 text-center">
                                <i class="fas fa-share-alt mr-2 text-accent-color"></i>Share This Venue
                            </h3>
                            <button onclick="shareVenue()" class="btn-primary text-white w-full py-3 px-6 rounded-lg font-bold">
                                <i class="fas fa-share-alt mr-2"></i>Share Venue
                            </button>
                        </div>

                        <!-- Back to Venues -->
                        <a href="/all-venues" class="btn-secondary text-white w-full py-3 px-6 rounded-lg font-bold text-center block">
                            <i class="fas fa-arrow-left mr-2"></i>Back to Venues
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="border-t-2 border-gray-800 p-8 mt-16">
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
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/events'>Events</a></li>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/all-venues'>Venues</a></li>
                        <li class="mb-2"><a href="/promoter-tool" class="text-gray-400 hover:text-white transition-colors">Promoter Tools</a></li>
                        <li class="mb-2"><a href="/admin/settings" class="text-gray-400 hover:text-white transition-colors">ADMIN</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="font-bold text-lg mb-4 text-white">About</h4>
                    <ul>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/community'>Community & FAQ</a></li>
                        <li class="mb-2"><a href="/contact" class="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/privacy-policy'>Privacy Policy</a></li>
                        <li class="mb-2"><a class='text-gray-400 hover:text-white transition-colors' href='/terms-and-conditions'>Terms and Conditions</a></li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    <script>
        function shareVenue() {
            if (navigator.share) {
                navigator.share({
                    title: '{{venue.name}} - BrumOutLoud',
                    text: '{{venue.description}}',
                    url: window.location.href
                }).catch(console.error);
            } else {
                navigator.clipboard.writeText(window.location.href).then(() => {
                    alert('Venue link copied to clipboard!');
                }).catch(() => {
                    const textArea = document.createElement('textarea');
                    textArea.value = window.location.href;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('Venue link copied to clipboard!');
                });
            }
        }
    </script>
</body>
</html>`;

exports.handler = async (event, context) => {
    if (!firebaseInitialized) {
        return {
            statusCode: 500,
            body: 'Firebase not initialized'
        };
    }

    // Extract slug from query parameters
    let slug = event.queryStringParameters?.slug;
    
    if (!slug && event.path.includes('/venue/')) {
        const pathParts = event.path.split('/');
        slug = pathParts[pathParts.length - 1];
    }
    
    if (!slug) {
        return { 
            statusCode: 400, 
            body: 'Error: Venue slug not provided.' 
        };
    }

    try {
        console.log("Attempting to fetch venue with slug:", slug);
        
        // Get venue data from Firestore
        const venueData = await getVenueBySlug(slug);
        
        if (!venueData) {
            console.log("No venue found with slug:", slug);
            return { 
                statusCode: 404, 
                body: 'Venue not found.' 
            };
        }

        console.log("Venue found:", venueData.name);

        // Get upcoming events for this venue
        const upcomingEvents = await getUpcomingEventsForVenue(venueData.slug, 6);

        // Enrich venue data for template
        const enrichedVenue = enrichVenueForTemplate(venueData, upcomingEvents);
        
        // Compile and render template
        const template = Handlebars.compile(embeddedVenueTemplate);
        const html = template({ venue: enrichedVenue });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=300'
            },
            body: html
        };

    } catch (error) {
        console.error('Error generating venue page:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Error - Venue Not Found</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>Venue Not Found</h1>
                    <p>The venue you're looking for could not be found.</p>
                    <a href="/all-venues">← Back to Venues</a>
                </body>
                </html>
            `
        };
    }
};

// Get venue by slug
async function getVenueBySlug(slug) {
    try {
        const venuesRef = db.collection('venues');
        const snapshot = await venuesRef.where('slug', '==', slug).limit(1).get();
        
        if (snapshot.empty) {
            return null;
        }
        
        const doc = snapshot.docs[0];
        return processVenueForDetails({
            id: doc.id,
            ...doc.data()
        });
    } catch (error) {
        console.error('Error fetching venue by slug:', error);
        return null;
    }
}

function processVenueForDetails(venueData) {
    console.log("Processing venue data:", venueData.name || venueData['Venue Name'], "Keys:", Object.keys(venueData));
    
    // Extract image URL from various possible formats
    let imageUrl = null;
    if (venueData.image) {
        if (Array.isArray(venueData.image) && venueData.image.length > 0) {
            imageUrl = venueData.image[0].url || venueData.image[0];
        } else if (typeof venueData.image === 'string') {
            imageUrl = venueData.image;
        } else if (venueData.image.url) {
            imageUrl = venueData.image.url;
        }
    }

    // Handle tags
    let tags = [];
    if (venueData.tags) {
        tags = Array.isArray(venueData.tags) ? venueData.tags : [venueData.tags];
    } else if (venueData.Tags) {
        tags = Array.isArray(venueData.Tags) ? venueData.Tags : [venueData.Tags];
    }

    const processedData = {
        id: venueData.id,
        name: venueData.name || venueData['Venue Name'] || 'Unknown Venue',
        slug: venueData.slug || '',
        description: venueData.description || venueData.Description || '',
        address: venueData.address || venueData.Address || '',
        phone: venueData.phone || venueData.Phone || '',
        website: venueData.website || venueData.Website || '',
        imageUrl: imageUrl,
        tags: tags
    };

    console.log("Processed venue data:", {
        name: processedData.name,
        hasDescription: !!processedData.description,
        hasImage: !!processedData.imageUrl,
        tagCount: processedData.tags.length
    });

    return processedData;
}

async function getUpcomingEventsForVenue(venueSlug, limit = 6) {
    try {
        const eventsRef = db.collection('events');
        const now = new Date();
        
        const snapshot = await eventsRef
            .where('venueSlug', '==', venueSlug)
            .where('date', '>=', now)
            .orderBy('date', 'asc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => {
            const eventData = doc.data();
            const eventDate = eventData.date ? new Date(eventData.date) : null;
            
            return {
                id: doc.id,
                name: eventData.name,
                slug: eventData.slug,
                date: eventData.date,
                dayOfMonth: eventDate ? eventDate.getDate() : '',
                monthAbbr: eventDate ? eventDate.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() : '',
                time: eventDate ? eventDate.toLocaleTimeString('en-GB', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                }) : ''
            };
        });
    } catch (error) {
        console.error('Error fetching upcoming events for venue:', error);
        return [];
    }
}

function enrichVenueForTemplate(venueData, upcomingEvents = []) {
    // Format description with line breaks
    const formattedDescription = venueData.description ? 
        venueData.description.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>') : 
        '';

    return {
        ...venueData,
        formattedDescription,
        upcomingEvents,
        tags: Array.isArray(venueData.tags) ? venueData.tags : []
    };
} 