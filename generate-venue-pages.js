const fs = require('fs');
const path = require('path');

// Venue data - this could be fetched from the API in the future
const venues = [
    {
        name: 'Eden Bar',
        slug: 'eden-bar',
        description: 'Brings the best in live cabaret from across the U.K.; All-inclusive.',
        additionalDescription: 'This venue is a cornerstone of Birmingham\'s LGBTQ+ scene, offering a welcoming atmosphere and memorable experiences for all visitors.',
        address: '138 Gooch St, Birmingham, B5 7HF',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750532560/brumoutloud_venues/tl9qhbq5u7s0p7tiopub.webp',
        websiteUrl: 'https://theedenbar.co.uk/',
        websiteDisplay: 'theedenbar.co.uk',
        statusText: 'Open until 2:00 AM',
        hoursSummary: 'Open Daily 8 PM - 2 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Cabaret</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Live Shows</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>8:00 PM - 2:00 AM</span></div>'
        ]
    },
    {
        name: 'Equator Bar',
        slug: 'equator-bar',
        description: 'Hurst Street\'s "Little Gem"; Situated in the heart of Birmingham\'s Gay Village; At the heart of the community for over 20 years.',
        additionalDescription: 'This venue is a cornerstone of Birmingham\'s LGBTQ+ scene, offering a welcoming atmosphere and memorable experiences for all visitors.',
        address: '123 Hurst Street, Birmingham, B5 6SE',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750524014/brumoutloud_venues/v6ykabboxlkeb1ivshjb.webp',
        websiteUrl: 'https://www.equator-bar.co.uk/',
        websiteDisplay: 'equator-bar.co.uk',
        statusText: 'Open until 2:00 AM',
        hoursSummary: 'Open Daily 8 PM - 2 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Bar</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Community</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>8:00 PM - 2:00 AM</span></div>'
        ]
    },
    {
        name: 'Glamorous',
        slug: 'glamorous',
        description: 'LGBTQIA+ Nightclub; Booming and energetic venue catering to any age; Open until the early hours to keep the party going.',
        additionalDescription: 'This venue is a cornerstone of Birmingham\'s LGBTQ+ scene, offering a welcoming atmosphere and memorable experiences for all visitors.',
        address: '27-35 Hurst St, Birmingham, B5 4BD',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750526040/brumoutloud_venues/cghnw3anncyelp8q6bqi.jpg',
        websiteUrl: 'https://glamorous.bar/',
        websiteDisplay: 'glamorous.bar',
        statusText: 'Open until 2:00 AM',
        hoursSummary: 'Open Daily 8 PM - 2 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Nightclub</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Multi-floor</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Drag Shows</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>8:00 PM - 2:00 AM</span></div>'
        ]
    },
    {
        name: 'Missing Bar',
        slug: 'missing-bar',
        description: 'Birmingham\'s Party Bar; Lively and welcoming venue; Cornerstone of LGBTQ+ nightlife; Award-winning for friendly atmosphere.',
        additionalDescription: 'This venue is a cornerstone of Birmingham\'s LGBTQ+ scene, offering a welcoming atmosphere and memorable experiences for all visitors.',
        address: '48 Bromsgrove Street, Birmingham, West Midlands, B5 6NU',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750522112/brumoutloud_venues/hklgqqh62nrj9853vkyi.jpg',
        websiteUrl: 'https://www.missingbar.co.uk/',
        websiteDisplay: 'missingbar.co.uk',
        statusText: 'Open until 2:00 AM',
        hoursSummary: 'Open Daily 8 PM - 2 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Party Bar</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Award-winning</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>8:00 PM - 2:00 AM</span></div>'
        ]
    },
    {
        name: 'The Fountain inn',
        slug: 'the-fountain-inn',
        description: 'Bar and rooms establishment; Traditional gay bar; Formerly men-only, now welcomes everyone.',
        additionalDescription: 'This venue is a cornerstone of Birmingham\'s LGBTQ+ scene, offering a welcoming atmosphere and memorable experiences for all visitors.',
        address: '102 Wrentham St, Birmingham B5 6QL',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750525630/brumoutloud_venues/skll02caqypuu6mcwevi.jpg',
        websiteUrl: 'https://www.thefountain.bar/',
        websiteDisplay: 'thefountain.bar',
        statusText: 'Open until 2:00 AM',
        hoursSummary: 'Open Daily 8 PM - 2 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Traditional Bar</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Rooms Available</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>8:00 PM - 2:00 AM</span></div>'
        ]
    },
    {
        name: 'The Fox',
        slug: 'the-fox',
        description: 'One of Birmingham\'s oldest and most loved LGBTQ+ pubs; Traditional Victorian pub; Warm and welcoming atmosphere; Particular favourite with the lesbian community, but inclusive to all.',
        additionalDescription: 'This venue is a cornerstone of Birmingham\'s LGBTQ+ scene, offering a welcoming atmosphere and memorable experiences for all visitors.',
        address: '17 Lower Essex St, Birmingham, B5 6SN',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750524201/brumoutloud_venues/gh2pkfvu5vgg9cxcczjc.jpg',
        websiteUrl: 'https://thefoxbar.co.uk/',
        websiteDisplay: 'thefoxbar.co.uk',
        statusText: 'Open until 2:00 AM',
        hoursSummary: 'Open Daily 8 PM - 2 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Victorian Pub</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Lesbian-friendly</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>8:00 PM - 2:00 AM</span></div>'
        ]
    },
    {
        name: 'The Nightingale Club',
        slug: 'the-nightingale-club',
        description: 'Birmingham\'s oldest and largest LGBT venue; Heart of the local LGBTQIA+ nightlife and clubbing scene; Huge venue with capacity for 2000.',
        additionalDescription: 'From drag shows and themed nights to live performances and club nights, The Nightingale Club has been serving the LGBTQ+ community for decades, providing a safe and vibrant space for everyone to express themselves and celebrate their identity.',
        address: '18 Kent Street, Birmingham, B5 6RD, UK',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750521804/brumoutloud_venues/zpxr6pjmy6nd8vj25aup.jpg',
        websiteUrl: 'https://nightingaleclub.co.uk/',
        websiteDisplay: 'nightingaleclub.co.uk',
        statusText: 'Open until 3:00 AM',
        hoursSummary: 'Open Daily 9 PM - 3 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Nightclub</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Multi-floor</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Drag Shows</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Live Music</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Themed Nights</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>9:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>9:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>9:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>9:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>9:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>9:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>9:00 PM - 3:00 AM</span></div>'
        ]
    },
    {
        name: 'The Village Inn',
        slug: 'the-village-inn',
        description: 'Cabaret bar; Beating heart of the Gay Village; Always buzzing; Guarantees a warm welcome and a memorable night.',
        additionalDescription: 'This venue is a cornerstone of Birmingham\'s LGBTQ+ scene, offering a welcoming atmosphere and memorable experiences for all visitors.',
        address: '18 Kent St, Birmingham B5 6RD',
        imageUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1750523779/brumoutloud_venues/eef3pldclnhaahgsvcdb.jpg',
        websiteUrl: 'https://villagebirmingham.co.uk/',
        websiteDisplay: 'villagebirmingham.co.uk',
        statusText: 'Open until 2:00 AM',
        hoursSummary: 'Open Daily 8 PM - 2 AM',
        tags: [
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Cabaret Bar</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">LGBTQ+</span>',
            '<span class="inline-block bg-purple-100/20 text-purple-300 text-sm px-3 py-1 rounded-full">Gay Village</span>'
        ],
        openingHours: [
            '<div class="flex justify-between"><span>Monday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Tuesday</span><span>Closed</span></div>',
            '<div class="flex justify-between"><span>Wednesday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Thursday</span><span>8:00 PM - 2:00 AM</span></div>',
            '<div class="flex justify-between"><span>Friday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Saturday</span><span>8:00 PM - 3:00 AM</span></div>',
            '<div class="flex justify-between"><span>Sunday</span><span>8:00 PM - 2:00 AM</span></div>'
        ]
    }
];

// Read the template
const templatePath = path.join(__dirname, 'venue-template.html');
const template = fs.readFileSync(templatePath, 'utf8');

// Function to generate a venue page
function generateVenuePage(venue) {
    let content = template;
    
    // SEO copy pack: venue-specific meta titles & descriptions
    const venueMetaOverrides = {
        'the-fox': { metaTitle: 'The Fox Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: 'The Fox is Birmingham\u2019s cosiest gay bar on Lower Essex Street. See reviews, photos, what\u2019s on this week \u2014 karaoke Fridays, acoustic Saturdays, drag Sundays.' },
        'the-nightingale-club': { metaTitle: 'Nightingale Club Birmingham | Reviews, Photos & Upcoming Events | Brum Outloud', metaDescription: "Birmingham\u2019s iconic LGBTQ+ superclub on Kent Street. Two floors, multiple bars, huge capacity. See what\u2019s on \u2014 POUNDED Thursdays, Big Saturgay. Open Thu\u2013Sat." },
        'equator-bar': { metaTitle: 'Equator Bar Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "Equator Bar is a relaxed LGBTQ+ bar on Hurst Street, open 20+ years. Coffee by day, cocktails by night. See reviews, photos and upcoming events." },
        'missing-bar': { metaTitle: 'Missing Bar Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "Missing Bar is Birmingham\u2019s late-night party bar in the Gay Village. Open till 4am Fri\u2013Sat. See reviews, photos, upcoming drag shows and events." },
        'eden-bar': { metaTitle: 'Eden Bar Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "Gooch Street\u2019s award-winning LGBTQ+ cabaret bar. Two floors, terrace and live shows from across the UK. See reviews, photos and what\u2019s on." },
        'glamorous': { metaTitle: 'Glamorous Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "Hurst Street\u2019s late-night LGBTQ+ nightclub, open until 6am. Renovated in 2025 with new management. See reviews, photos and upcoming events." },
        'the-village-inn': { metaTitle: 'The Village Inn Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "The beating heart of Birmingham\u2019s Gay Village. Cabaret bar with drag and live entertainment seven nights a week. See reviews, photos and what\u2019s on." },
        'the-fountain-inn': { metaTitle: 'The Fountain Inn Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "One of Birmingham\u2019s most beloved traditional gay pubs on Wrentham Street. Welcoming and affordable. See reviews, photos and upcoming events." },
        'the-loft': { metaTitle: 'The Loft Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "A laid-back LGBTQ+ bar in Birmingham\u2019s Gay Village. Great drinks, friendly crowd, no pressure. See reviews, photos and what\u2019s on this week." },
        'the-hub': { metaTitle: 'The Hub at Eden Birmingham | Reviews, Photos & What\u2019s On | Brum Outloud', metaDescription: "Event space with chillout area and roof garden within Eden Bar Birmingham. See reviews, photos, upcoming events and hire info." }
    };
    const metaOverride = venueMetaOverrides[venue.slug] || {};

    // Replace all placeholders
    content = content.replace(/\{\{VENUE_META_TITLE\}\}/g, metaOverride.metaTitle || `${venue.name} Reviews, Photos & Events | LGBTQ+ Birmingham Gay Bar | Brum Outloud`);
    content = content.replace(/\{\{VENUE_META_DESCRIPTION\}\}/g, metaOverride.metaDescription || `Read reviews, view photos, and see upcoming events for ${venue.name}, a popular LGBTQ+ venue and gay bar in Birmingham. ${venue.description}`);
    content = content.replace(/\{\{VENUE_NAME\}\}/g, venue.name);
    content = content.replace(/\{\{VENUE_SLUG\}\}/g, venue.slug);
    content = content.replace(/\{\{VENUE_DESCRIPTION\}\}/g, venue.description);
    content = content.replace(/\{\{VENUE_ADDITIONAL_DESCRIPTION\}\}/g, venue.additionalDescription);
    content = content.replace(/\{\{VENUE_ADDRESS\}\}/g, venue.address);
    content = content.replace(/\{\{VENUE_IMAGE_URL\}\}/g, venue.imageUrl);
    content = content.replace(/\{\{VENUE_WEBSITE_URL\}\}/g, venue.websiteUrl);
    content = content.replace(/\{\{VENUE_WEBSITE_DISPLAY\}\}/g, venue.websiteDisplay);
    content = content.replace(/\{\{VENUE_STATUS_TEXT\}\}/g, venue.statusText);
    content = content.replace(/\{\{VENUE_HOURS_SUMMARY\}\}/g, venue.hoursSummary);
    content = content.replace(/\{\{VENUE_TAGS\}\}/g, venue.tags.join(''));
    content = content.replace(/\{\{VENUE_OPENING_HOURS\}\}/g, venue.openingHours.join('\n                                '));
    
    return content;
}

// Function to update all venue pages
function updateAllVenuePages() {
    console.log('🔄 Updating all venue pages from template...');
    
    venues.forEach(venue => {
        const venuePath = path.join(__dirname, 'venue', `${venue.slug}.html`);
        const content = generateVenuePage(venue);
        
        fs.writeFileSync(venuePath, content);
        console.log(`✅ Updated: ${venue.name} (${venue.slug}.html)`);
    });
    
    console.log(`\n🎉 Successfully updated ${venues.length} venue pages!`);
}

// Function to generate a single venue page
function generateSingleVenuePage(venueSlug) {
    const venue = venues.find(v => v.slug === venueSlug);
    if (!venue) {
        console.error(`❌ Venue not found: ${venueSlug}`);
        return;
    }
    
    const venuePath = path.join(__dirname, 'venue', `${venue.slug}.html`);
    const content = generateVenuePage(venue);
    
    fs.writeFileSync(venuePath, content);
    console.log(`✅ Generated: ${venue.name} (${venue.slug}.html)`);
}

// Function to list all venues
function listVenues() {
    console.log('📋 Available venues:');
    venues.forEach(venue => {
        console.log(`  • ${venue.name} (${venue.slug})`);
    });
}

// Command line interface
const command = process.argv[2];
const venueSlug = process.argv[3];

switch (command) {
    case 'update-all':
        updateAllVenuePages();
        break;
    case 'generate':
        if (!venueSlug) {
            console.error('❌ Please provide a venue slug');
            console.log('Usage: node generate-venue-pages.js generate <venue-slug>');
            break;
        }
        generateSingleVenuePage(venueSlug);
        break;
    case 'list':
        listVenues();
        break;
    default:
        console.log('🎯 Venue Page Generator');
        console.log('');
        console.log('Commands:');
        console.log('  node generate-venue-pages.js update-all     - Update all venue pages from template');
        console.log('  node generate-venue-pages.js generate <slug> - Generate a single venue page');
        console.log('  node generate-venue-pages.js list           - List all available venues');
        console.log('');
        console.log('Examples:');
        console.log('  node generate-venue-pages.js update-all');
        console.log('  node generate-venue-pages.js generate glamorous');
        console.log('  node generate-venue-pages.js list');
}