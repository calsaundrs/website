const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');
const { execSync } = require('child_process');

const currentYear = new Date().getFullYear();
const nextYear = currentYear + 1;

// Define series and automatically inject dynamic years into keywords
const SERIES_EVENTS = [
  {
    id: 'xxl',
    name: 'XXL Birmingham',
    slug: 'xxl',
    keywords: ['xxl birmingham', 'xxl club birmingham', 'xxl gay', `xxl birmingham ${currentYear} dates`, `xxl birmingham ${nextYear}`],
    description: 'Find the next XXL Birmingham event dates, tickets, and info. The legendary men-only club night in Birmingham.',
    searchQuery: 'xxl'
  },
  {
    id: 'hardon',
    name: 'Hard On Birmingham',
    slug: 'hard-on',
    keywords: ['hard on birmingham', 'hardon birmingham', 'hard on club birmingham', `hard on birmingham ${currentYear}`, `hard on birmingham ${nextYear}`],
    description: 'Find the next Hard On Birmingham event dates and tickets. The iconic fetish and cruise club night.',
    searchQuery: 'hard on'
  },
  {
    id: 'beefmince',
    name: 'BEEFMINCE Birmingham',
    slug: 'beefmince',
    keywords: ['beefmince birmingham', 'beef mince birmingham', 'beefmince club', `beefmince birmingham ${currentYear}`],
    description: 'Find the next BEEFMINCE Birmingham dates and tickets. The welcoming bear, cub, and broader community club night.',
    searchQuery: 'beefmince'
  },
  {
    id: 'dilf',
    name: 'DILF Birmingham',
    slug: 'dilf',
    keywords: ['dilf birmingham', 'dilf club birmingham', 'dilf events birmingham', `dilf birmingham ${currentYear}`],
    description: 'Find the next DILF Birmingham event dates and tickets. The popular men-only club night for dads, lads, bears, and more.',
    searchQuery: 'dilf'
  }
];

// Instead of doing an API fetch, we can just run the `get-events` function locally or parse the build-events-ssg output if needed, but the easiest way is to use the local API if it's running, or parse output.json if available. Actually, since this runs in build, let's just make a fetch call to the live site to get the current events during build, or if we want to be fully independent, we require the function directly.
// To keep it simple and robust, let's fetch from the production API during build.
async function fetchEvents() {
    try {
        const response = await fetch('https://brumoutloud.co.uk/.netlify/functions/get-events');
        if (response.ok) {
            const data = await response.json();
            return Array.isArray(data) ? data : (data.events || []);
        }
    } catch (e) {
        console.warn('Failed to fetch events from API during build', e);
    }
    return [];
}

const templateContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{name}} | Next Dates & Tickets | Brum Outloud</title>
    <meta name="description" content="{{description}}">
    <meta name="keywords" content="{{join keywords ','}}">

    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="{{name}} | Next Dates & Tickets | Brum Outloud">
    <meta property="og:description" content="{{description}}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://brumoutloud.co.uk/series/{{slug}}">
    <meta property="og:image" content="https://www.brumoutloud.co.uk/progressflag.svg.png">

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{name}} | Next Dates & Tickets | Brum Outloud">
    <meta name="twitter:description" content="{{description}}">
    <meta name="twitter:image" content="https://www.brumoutloud.co.uk/progressflag.svg.png">

    <!-- Canonical URL -->
    <link rel="canonical" href="https://www.brumoutloud.co.uk/series/{{slug}}">

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">

    <!-- Styles -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">

    <style>
        :root {
            --color-bg: #0D0115;
            --color-light: #f3e8ff;
            --color-toxic: #CCFF00;
            --color-purple: #9B5DE5;
            --color-pink: #E83A99;
        }
        body {
            background: var(--color-bg);
            color: var(--color-light);
            font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 0;
        }
        .font-display { font-family: 'Syne', sans-serif; }
        .misprint { letter-spacing: -0.03em; line-height: 0.95; }

        .progress-pride-bg {
            background: linear-gradient(90deg, #000000 0%, #784F17 8%, #55CDFC 16%, #F7A8B8 24%, #FFFFFF 32%, #FFF430 40%, #FF8C00 48%, #E40303 56%, #FF8C00 64%, #FFF430 72%, #008026 80%, #004DFF 88%, #750787 100%);
        }

        .sticker {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border: 2px solid currentColor;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            transform: rotate(-2deg);
        }
    </style>

    <!-- FOUC Prevention Script -->
    <script src="/js/fouc-prevention.js"></script>
</head>
<body>
    <!-- Header -->
    <header class="sticky top-0 z-[100] transition-all duration-300">
        <nav class="bg-black pt-4 px-4 pb-5 flex justify-between items-center relative z-10 shadow-[4px_4px_0_var(--color-toxic)]">
            <div class="absolute bottom-0 left-0 w-full h-[6px] progress-pride-bg"></div>
            <div class="font-display font-black text-2xl md:text-3xl misprint leading-none flex items-center">
                <a href="/" class="hover:opacity-80 transition-opacity">BRUM<br><span class="text-[var(--color-purple)]">OUT</span>LOUD</a>
            </div>
            <div class="hidden lg:flex items-center space-x-8 font-bold text-sm uppercase tracking-widest">
                <a href="/events" class="hover:text-[var(--color-toxic)] transition-colors">WHAT'S ON</a>
                <a href="/all-venues" class="hover:text-[var(--color-toxic)] transition-colors">VENUES</a>
                <a href="/clubs" class="hover:text-[var(--color-toxic)] transition-colors">CLUBS</a>
                <a href="/birmingham-pride" class="hover:text-[var(--color-toxic)] transition-colors">PRIDE</a>
                <a href="/community" class="hover:text-[var(--color-toxic)] transition-colors">COMMUNITY</a>
                <a href="/contact" class="hover:text-[var(--color-toxic)] transition-colors">CONTACT</a>
                <a href="/promoter-submit-new" class="sticker bg-[var(--color-toxic)] !text-black text-sm hover:bg-white transition-colors">GET LISTED</a>
            </div>
            <div class="lg:hidden relative z-[60]">
                <button id="menu-btn" class="text-white text-2xl">
                    <i class="fas fa-bars"></i>
                </button>
            </div>
        </nav>
        <div id="menu" class="hidden lg:hidden fixed inset-0 bg-black z-50 flex flex-col items-center justify-center space-y-6">
            <a href="/events" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">WHAT'S ON</a>
            <a href="/all-venues" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">VENUES</a>
            <a href="/clubs" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">CLUBS</a>
            <a href="/birmingham-pride" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">PRIDE</a>
            <a href="/community" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">COMMUNITY</a>
            <a href="/contact" class="block text-white text-4xl py-4 font-display font-black hover:text-[var(--color-toxic)]">CONTACT</a>
            <a href="/promoter-submit-new" class="block mt-4 sticker bg-[var(--color-toxic)] !text-black text-2xl">GET LISTED</a>
        </div>
    </header>

    <main class="max-w-5xl mx-auto px-6 md:px-12 py-12">
        <div class="mb-12">
            <h1 class="text-4xl md:text-6xl font-black text-white uppercase font-display misprint mb-4">{{name}}</h1>
            <p class="text-xl text-gray-300 max-w-3xl">Looking for the next <strong>{{name}}</strong> dates in Birmingham? Here are the upcoming events.</p>
        </div>

        <section>
            <h2 class="text-2xl font-bold text-white mb-6 uppercase font-display">
                <span class="text-[var(--color-toxic)] mr-2">///</span> Upcoming Dates
            </h2>

            {{#if matchedEvents.length}}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                {{#each matchedEvents}}
                <a href="/event/{{slug}}" class="block bg-white/5 border-2 border-transparent hover:border-[var(--color-toxic)] p-5 flex items-center space-x-4 transition-all duration-200 group">
                    <div class="text-center w-20 flex-shrink-0">
                        <p class="text-3xl font-black text-[var(--color-toxic)] font-display">{{day}}</p>
                        <p class="text-sm text-gray-400 uppercase font-bold">{{month}}</p>
                    </div>
                    <div class="flex-grow">
                        <h3 class="font-bold text-white text-xl mb-1">{{name}}</h3>
                        <p class="text-sm text-gray-400"><i class="fas fa-clock mr-1 text-[var(--color-purple)]"></i> {{time}}</p>
                        <p class="text-sm text-gray-400"><i class="fas fa-map-marker-alt mr-1 text-[var(--color-purple)]"></i> {{venueName}}</p>
                    </div>
                    <div class="text-[var(--color-toxic)] group-hover:translate-x-1 transition-transform">
                        <i class="fas fa-arrow-right text-xl"></i>
                    </div>
                </a>
                {{/each}}
            </div>
            {{else}}
            <div class="py-12 border-2 border-white/10 text-center">
                <i class="fas fa-calendar-times text-4xl text-gray-600 mb-4 block"></i>
                <h3 class="text-xl font-bold text-white mb-2 uppercase font-display">No Confirmed Dates</h3>
                <p class="text-gray-400">There are currently no confirmed upcoming dates for {{name}} in our system. Check back soon!</p>
            </div>
            {{/if}}
        </section>

        <section class="mt-16 pt-12 border-t border-white/10">
            <h2 class="text-2xl font-bold text-white mb-6 uppercase font-display">
                <span class="text-[var(--color-toxic)] mr-2">///</span> More in Birmingham
            </h2>
            <div class="flex flex-wrap gap-4">
                <a href="/events" class="bg-[var(--color-purple)] text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-[var(--color-toxic)] hover:text-black transition-colors">All Events</a>
                <a href="/all-venues" class="bg-white/10 text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-white/20 transition-colors">Gay Village Venues</a>
            </div>
        </section>
    </main>

    <!-- Footer -->
    <footer class="bg-black border-t-4 border-[var(--color-light)] mt-16">
        <div class="h-[6px] progress-pride-bg"></div>
        <div class="container mx-auto px-6 py-12">
            <div class="grid md:grid-cols-3 gap-12">
                <div>
                    <div class="font-display font-black text-4xl misprint leading-none mb-6">
                        BRUM<br><span class="text-[var(--color-purple)]">OUT</span>LOUD
                    </div>
                    <p class="text-gray-400 text-sm leading-relaxed mb-6">Birmingham's home for LGBTQ+ events, venues, and community.</p>
                </div>
                <div>
                    <h4 class="font-bold text-sm mb-4 text-[var(--color-toxic)] uppercase tracking-widest">Explore</h4>
                    <div class="flex flex-col gap-3 font-bold text-sm uppercase tracking-widest">
                        <a href="/events" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Events</a>
                        <a href="/all-venues" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Venues</a>
                        <a href="/community" class="hover:text-[var(--color-toxic)] transition-colors underline decoration-2 underline-offset-4">Community</a>
                    </div>
                </div>
                <div class="md:text-right">
                    <p class="font-bold text-sm text-[var(--color-purple)] uppercase tracking-widest">&copy; 2026 BRUM OUTLOUD</p>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Mobile menu
        document.getElementById('menu-btn').addEventListener('click', () => {
            const menu = document.getElementById('menu');
            menu.classList.toggle('hidden');
            menu.classList.toggle('flex');
        });
    </script>
</body>
</html>`;

Handlebars.registerHelper('join', function(array, sep) {
    if(!array) return '';
    return array.join(sep);
});

async function buildSeriesPages() {
    console.log('Generating series landing pages...');

    // Create series directory
    const seriesDir = path.join(__dirname, 'series');
    try {
        await fs.mkdir(seriesDir, { recursive: true });
    } catch (e) {
        // Ignore if exists
    }

    // Fetch all events once
    const allEvents = await fetchEvents();
    const now = new Date();
    now.setHours(0,0,0,0);

    const template = Handlebars.compile(templateContent);

    for (const series of SERIES_EVENTS) {
        // Find matching events
        const searchQuery = series.searchQuery.toLowerCase();

        const matchedEvents = allEvents.filter(e => {
            const eventDate = new Date(e.date);
            const nameMatch = e.name && e.name.toLowerCase().includes(searchQuery);
            const descMatch = e.description && e.description.toLowerCase().includes(searchQuery);
            return eventDate >= now && (nameMatch || descMatch);
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Format dates for the template
        const formattedEvents = matchedEvents.map(event => {
            const date = new Date(event.date);
            const time = date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
            return {
                ...event,
                day: date.getDate(),
                month: date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
                time: time !== '0:00' && time !== '00:00' ? time : 'Time TBC',
                venueName: event.venueName ? (Array.isArray(event.venueName) ? event.venueName[0] : event.venueName) : 'Venue TBC',
                slug: event.slug || (event.name ? event.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '')
            };
        });

        series.matchedEvents = formattedEvents;

        const html = template(series);
        const filePath = path.join(seriesDir, `${series.slug}.html`);
        await fs.writeFile(filePath, html, 'utf8');
        console.log(`✅ Generated: ${filePath} (Found ${formattedEvents.length} events)`);
    }

    console.log('Series pages generated successfully.');
}

buildSeriesPages().catch(console.error);
