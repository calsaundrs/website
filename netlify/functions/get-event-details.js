const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

// All helper functions from your original file remain at the top.

exports.handler = async function (event, context) {
    const slug = event.path.split("/").pop();
    const baseUrl = process.env.URL || 'https://www.brumoutloud.co.uk';
    if (!slug) {
        return { statusCode: 400, body: 'Error: Event slug not provided.' };
    }

    try {
        // --- The entire event fetching logic remains unchanged ---
        const dateMatch = slug.match(/\d{4}-\d{2}-\d{2}$/);
        let eventRecords = [];

        if (dateMatch) {
            const dateFromSlug = dateMatch[0];
            eventRecords = await base('Events').select({ maxRecords: 1, filterByFormula: `AND({Slug} = "${slug}", DATETIME_FORMAT(Date, 'YYYY-MM-DD') = '${dateFromSlug}')` }).firstPage();
        } else {
            eventRecords = await base('Events').select({ maxRecords: 1, filterByFormula: `{Slug} = "${slug}"` }).firstPage();
            if (!eventRecords || eventRecords.length === 0) {
                const escapedSlug = slug.replace(/"/g, '\\"');
                const seriesAnchorFilter = `OR({Slug} = "${escapedSlug}", FIND("${escapedSlug}-", {Slug}) = 1)`;
                const seriesAnchorRecords = await base('Events').select({ maxRecords: 1, filterByFormula: seriesAnchorFilter }).firstPage();
                if (seriesAnchorRecords && seriesAnchorRecords.length > 0) {
                    const anchorRecord = seriesAnchorRecords[0];
                    const seriesNameForQuery = anchorRecord.fields['Parent Event Name'] || anchorRecord.fields['Event Name'];
                    if (!seriesNameForQuery) return { statusCode: 404, body: `Could not identify series name for '${slug}'.` };
                    const escapedSeriesName = seriesNameForQuery.replace(/"/g, '\\"');
                    const nextInstanceFilter = `AND(OR({Parent Event Name} = "${escapedSeriesName}", {Event Name} = "${escapedSeriesName}"), IS_AFTER({Date}, DATEADD(TODAY(), -1, 'days')))`
                    const nextInstanceRecords = await base('Events').select({ maxRecords: 1, filterByFormula: nextInstanceFilter, sort: [{ field: 'Date', direction: 'asc' }] }).firstPage();
                    if (nextInstanceRecords && nextInstanceRecords.length > 0) {
                        const nextInstanceSlug = nextInstanceRecords[0].fields.Slug;
                        if (nextInstanceSlug) return { statusCode: 302, headers: { 'Location': `/event/${nextInstanceSlug}` } };
                    }
                    return { statusCode: 404, body: `Event series '${seriesNameForQuery}' has concluded or has no upcoming dates.` };
                } else {
                    return { statusCode: 404, body: `Event '${slug}' not found.` };
                }
            }
        }
        
        const eventRecord = eventRecords[0];
        const fields = eventRecord.fields;
        const eventName = fields['Event Name'];
        const recurringInfo = fields['Recurring Info'];

        const categoryTags = fields['Category'] || [];
        const tagsHtml = categoryTags.map(tag => `<span class="inline-block bg-gray-700 text-gray-300 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">${tag}</span>`).join('');


        let venueNameForDisplay = fields['Venue Name'] ? fields['Venue Name'][0] : (fields['VenueText'] || 'TBC');
        let venueHtml = `<p class="text-2xl font-semibold">${venueNameForDisplay}</p>`;
        const venueId = fields['Venue'] ? fields['Venue'][0] : null;

        if (venueId) {
            try {
                const venueRecord = await base('Venues').find(venueId);
                const status = venueRecord.get('Listing Status');
                const name = venueRecord.get('Name');
                const venueSlug = venueRecord.get('Slug');
                venueNameForDisplay = name || venueNameForDisplay;
                if (status === 'Listed' && venueSlug) {
                    venueHtml = `<a href="/venue/${venueSlug}" class="text-2xl font-semibold hover:text-white underline">${venueNameForDisplay}</a>`;
                }
            } catch (venueError) { console.error("Could not fetch linked venue.", venueError); }
        }

        let suggestedEventsHtml = '';
        const currentEventId = eventRecord.id;

        if (categoryTags.length > 0) {
            const categoryFilterString = categoryTags.map(cat => `FIND("${cat.replace(/"/g, '\\"')}", ARRAYJOIN({Category}, ","))`).join(', ');
            const suggestedEventsFilter = `AND({Status} = 'Approved', IS_AFTER({Date}, TODAY()), NOT(RECORD_ID() = '${currentEventId}'), OR(${categoryFilterString}))`;
            const suggestedRecords = await base('Events').select({
                filterByFormula: suggestedEventsFilter,
                sort: [{ field: 'Date', direction: 'asc' }],
                maxRecords: 6,
                fields: ['Event Name', 'Date', 'Promo Image', 'Slug']
            }).all();

            if (suggestedRecords.length > 0) {
                const suggestedCardsHtml = suggestedRecords.map(suggEvent => {
                    const suggEventName = suggEvent.get('Event Name');
                    const suggEventDate = new Date(suggEvent.get('Date'));
                    const suggImageUrl = suggEvent.get('Promo Image') ? suggEvent.get('Promo Image')[0].url : 'https://placehold.co/400x600/1e1e1e/EAEAEA?text=Event';
                    const suggEventSlug = suggEvent.get('Slug');
                    return `<a href="/event/${suggEventSlug}" class="suggested-card block rounded-xl overflow-hidden group bg-gray-800/50">
            <div class="relative">
                <img src="${suggImageUrl}" alt="${suggEventName}" class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105">
            </div>
            <div class="p-4">
                <h4 class="font-bold text-white text-lg mb-1 truncate">${suggEventName}</h4>
                <p class="text-sm text-gray-400">${suggEventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
        </a>`;
                }).join('');
                suggestedEventsHtml = `<div class="mt-16 suggested-events-section"><h2 class="font-anton text-4xl mb-8">Don't Miss These...</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${suggestedCardsHtml}</div></div>`;
            }
        }

        const eventDate = new Date(fields['Date']);
        const description = fields['Description'] || 'No description provided.';
        const pageUrl = `https://brumoutloud.co.uk${event.path}`;
        const imageUrl = fields['Promo Image'] ? fields['Promo Image'][0].url : 'https://placehold.co/1200x675/1a1a1a/f5efe6?text=Brum+Out+Loud';
        const endTime = fields['End Time'] ? new Date(fields['End Time']) : new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);

        const calendarData = {
            title: eventName,
            description: `${description}\n\nFind out more: ${pageUrl}`,
            location: venueNameForDisplay,
            startTime: eventDate.toISOString(),
            endTime: endTime.toISOString(),
        };

        const html = `<!DOCTYPE html><html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${eventName} | Brum Outloud</title>
    <meta name="description" content="${description.substring(0, 150).replace(/\n/g, ' ')}...">
    <link rel="canonical" href="${baseUrl}/event/${slug}">
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    
    <style>
        .hero-image-link { display: block; position: relative; border-radius: 1.25rem; overflow: hidden; cursor: zoom-in; }
        .hero-image-link .image-overlay { position: absolute; inset: 0; background-color: rgba(0,0,0,0.5); opacity: 0; transition: opacity 0.3s ease; display: flex; align-items: center; justify-content: center; z-index: 20; }
        .hero-image-link:hover .image-overlay { opacity: 1; }
        .hero-image-link img { transition: transform 0.3s ease; }
        .hero-image-link:hover img { transform: scale(1.05); }

        .custom-lightbox { display: none; position: fixed; z-index: 9999; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.85); justify-content: center; align-items: center; padding: 15px; }
        .custom-lightbox.active { display: flex; }
        .custom-lightbox-image { max-width: 95vw; max-height: 90vh; object-fit: contain; border-radius: 0.5rem; }
        .custom-lightbox-close { cursor: pointer; position: absolute; top: 15px; right: 25px; color: white; background-color: rgba(0,0,0,0.5); border-radius: 50%; width: 44px; height: 44px; display: flex; justify-content: center; align-items: center; font-size: 28px; transition: background-color 0.2s; z-index: 10000; line-height: 1; }
        .custom-lightbox-close:hover { background-color: rgba(0,0,0,0.8); }

        .suggested-card { border-radius: 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); background-color: #1e1e1e; transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .suggested-card:hover { transform: translateY(-5px); box-shadow: 0 15px 40px rgba(0,0,0,0.5); }
        .social-button-sm { display: flex; align-items: center; justify-content: center; background-color: #374151; color: white; font-weight: bold; padding: 0.75rem 1rem; border-radius: 0.5rem; text-align: center; transition: background-color 0.2s; }
        .social-button-sm:hover { background-color: #4b5563; }
        .suggested-carousel { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; overflow-x: auto; padding-bottom: 1rem; scrollbar-width: thin; scrollbar-color: #4b5563 #1f2937; }
        .suggested-carousel::-webkit-scrollbar { height: 8px; }
        .suggested-carousel::-webkit-scrollbar-track { background: #1f2937; border-radius: 4px; }
        .suggested-carousel::-webkit-scrollbar-thumb { background-color: #4b5563; border-radius: 4px; }
    </style>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="/js/main.js" defer></script>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "${eventName.replace(/"/g, '\"')}",
      "startDate": "${eventDate.toISOString()}",
      "endDate": "${endTime.toISOString()}",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "location": { "@type": "Place", "name": "${venueNameForDisplay.replace(/"/g, '\"')}", "address": { "@type": "PostalAddress", "addressLocality": "Birmingham", "addressCountry": "UK" } },
      "image": [ "${imageUrl}" ],
      "description": "${description.replace(/\n/g, ' ').replace(/"/g, '\"')}",
      "url": "${pageUrl}",
      "offers": { "@type": "Offer", "url": "${fields['Link'] || pageUrl}", "price": "0", "priceCurrency": "GBP", "availability": "https://schema.org/InStock" }
    }
    <\/script>
    <link rel="icon" href="/faviconV2.png" type="image/png">
</head>
<body class="antialiased">
<div id="header-placeholder"><\/div>
<main class="container mx-auto px-8 py-16">
    <div class="grid lg:grid-cols-3 gap-16">
        <div class="lg:col-span-2">
            <a href="${imageUrl}" id="hero-image-link" class="hero-image-link mb-8">
                <div class="image-overlay">
                    <i class="fa-solid fa-expand text-white text-4xl"></i>
                </div>
                <img src="${imageUrl}" alt="${eventName}" class="aspect-[16/9] w-full object-cover">
            </a>
            <p class="font-semibold accent-color mb-2">EVENT DETAILS<\/p>
            <h1 class="font-anton text-6xl lg:text-8xl heading-gradient leading-none mb-4">${eventName}<\/h1>
            <div class="mb-8">${tagsHtml}</div>
            <div class="prose prose-invert prose-lg max-w-none text-gray-300">${description.replace(/\n/g, '<br>')}</div>
            ${suggestedEventsHtml}
        </div>
        <div class="lg:col-span-1">
            <div class="card-bg p-8 sticky top-8 space-y-6">
                <div><h3 class="font-bold text-lg accent-color-secondary mb-2">Date & Time<\/h3><p class="text-2xl font-semibold">${eventDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}<\/p><p class="text-xl text-gray-400">${eventDate.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' })}<\/p>${recurringInfo ? `<p class="mt-2 inline-block bg-teal-400/10 text-teal-300 text-xs font-semibold px-2 py-1 rounded-full">${recurringInfo}<\/p>` : ''}<\/div>
                <div><h3 class="font-bold text-lg accent-color-secondary mb-2">Location<\/h3>${venueHtml}<\/div>
                ${fields['Link'] ? `<a href="${fields['Link']}" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-accent-color text-white font-bold py-4 px-6 rounded-lg hover:opacity-90 transition-opacity text-xl">GET TICKETS<\/a>` : ''}
                
                <div id="add-to-calendar-section" class="border-t border-gray-700 pt-6">
                    <h3 class="font-bold text-lg accent-color-secondary mb-4 text-center">Add to Calendar</h3>
                    <div class="grid grid-cols-1 gap-2"></div>
                </div>

                <div class="border-t border-gray-700 pt-6">
                    <h3 class="font-bold text-lg accent-color-secondary mb-4 text-center">Share This Event</h3>
                    <div id="share-container" class="grid grid-cols-2 gap-2"></div>
                    <p id="copy-success" class="text-center text-green-400 text-sm mt-2" style="display: none;">Link Copied!</p>
                </div>
            </div>
        </div>
    </div>
</main>
<div id="footer-placeholder"><\/div>

<div id="custom-lightbox" class="custom-lightbox">
    <span id="custom-lightbox-close" class="custom-lightbox-close">&times;</span>
    <img id="custom-lightbox-image" class="custom-lightbox-image" src="">
</div>
        
<script>
    const calendarData = ${JSON.stringify(calendarData)};
    function toICSDate(dateStr) { return new Date(dateStr).toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'; }
    function escapeICSDescription(text) { return (text || '').replace(/\\n/g, '\\\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
    function generateGoogleLink() {
        const params = new URLSearchParams({ action: 'TEMPLATE', text: calendarData.title, dates: toICSDate(calendarData.startTime) + '/' + toICSDate(calendarData.endTime), details: calendarData.description, location: calendarData.location, ctz: 'Europe/London' });
        return 'https://www.google.com/calendar/render?' + params.toString();
    }
    function generateICSFile() {
        const description = escapeICSDescription(calendarData.description);
        const location = (calendarData.location || '').replace(/,/g, '\\,');
        const icsContent = [ 'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brum Outloud//EN', 'BEGIN:VEVENT', \`UID:\${toICSDate(calendarData.startTime)}@brumoutloud.co.uk\`, \`DTSTAMP:\${toICSDate(new Date())}\`, \`DTSTART:\${toICSDate(calendarData.startTime)}\`, \`DTEND:\${toICSDate(calendarData.endTime)}\`, \`SUMMARY:\${calendarData.title}\`, \`DESCRIPTION:\${description}\`, \`LOCATION:\${location}\`, 'END:VEVENT', 'END:VCALENDAR' ].join('\\r\\n');
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`\${calendarData.title.replace(/[^a-z0-9]/gi, '_')}.ics\`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.querySelector('#add-to-calendar-section .grid');
        if (!container) return;
        const googleLink = generateGoogleLink();
        const buttonsHTML = \`<a href="\${googleLink}" target="_blank" class="bg-gray-700 text-white font-bold py-3 px-4 rounded-lg text-center hover:bg-gray-600">Google Calendar</a><button id="btn-ics" class="bg-gray-700 text-white font-bold py-3 px-4 rounded-lg text-center hover:bg-gray-600">Apple/Outlook (.ics)</button>\`;
        container.innerHTML = buttonsHTML;
        document.getElementById('btn-ics').addEventListener('click', (e) => { e.preventDefault(); generateICSFile(); });
    });
</script>
<script>
    document.addEventListener('DOMContentLoaded', () => {
        const shareContainer = document.getElementById('share-container');
        if (!shareContainer) return;
        const pageUrl = window.location.href;
        const shareMessage = "Just saw this cool event on Brum Outloud! Wanna go? 👀";

        if (navigator.share) {
            const nativeShareBtn = document.createElement('button');
            nativeShareBtn.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket mr-2"></i>Share Event';
            nativeShareBtn.className = 'social-button-sm col-span-2';
            shareContainer.appendChild(nativeShareBtn);

            nativeShareBtn.addEventListener('click', async () => {
                try {
                    await navigator.share({ title: document.title, text: shareMessage, url: pageUrl });
                } catch (err) { console.error("Error sharing:", err); }
            });
        } else {
            const encodedPageUrl = encodeURIComponent(pageUrl);
            const fallbackHTML = \`<a id="share-x" href="#" target="_blank" class="social-button-sm"><i class="fa-brands fa-x-twitter mr-2"></i>Share on X</a><a id="share-facebook" href="#" target="_blank" class="social-button-sm"><i class="fa-brands fa-facebook-f mr-2"></i>Share</a><a id="share-whatsapp" href="#" target="_blank" class="social-button-sm"><i class="fa-brands fa-whatsapp mr-2"></i>Send</a><button id="copy-link" class="social-button-sm"><i class="fa-solid fa-link mr-2"></i>Copy Link</button>\`;
            shareContainer.innerHTML = fallbackHTML;
            
            document.getElementById('share-x').href = \`https://twitter.com/intent/tweet?text=\${encodeURIComponent(shareMessage)}&url=\${encodedPageUrl}\`;
            document.getElementById('share-facebook').href = \`https://www.facebook.com/sharer/sharer.php?u=\${encodedPageUrl}\`;
            const whatsappText = encodeURIComponent(\`\${shareMessage} \${pageUrl}\`);
            document.getElementById('share-whatsapp').href = \`https://api.whatsapp.com/send?text=\${whatsappText}\`;
            
            const copyButton = document.getElementById('copy-link');
            const copySuccessMessage = document.getElementById('copy-success');
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(pageUrl).then(() => {
                    copySuccessMessage.style.display = 'block';
                    copyButton.innerHTML = '<i class="fa-solid fa-check mr-2"></i>Copied!';
                    setTimeout(() => {
                        copySuccessMessage.style.display = 'none';
                        copyButton.innerHTML = '<i class="fa-solid fa-link mr-2"></i>Copy Link';
                    }, 2000);
                });
            });
        }
    });
</script>
<script>
    // Simplified Lightbox Script for single hero image
    document.addEventListener('DOMContentLoaded', () => {
        const heroLink = document.getElementById('hero-image-link');
        const lightbox = document.getElementById('custom-lightbox');
        const lightboxImage = document.getElementById('custom-lightbox-image');
        const lightboxClose = document.getElementById('custom-lightbox-close');

        if (!heroLink || !lightbox || !lightboxImage || !lightboxClose) return;

        const openLightbox = (imageUrl) => {
            lightboxImage.src = imageUrl;
            lightbox.classList.add('active');
        };

        const closeLightbox = () => {
            lightbox.classList.remove('active');
            lightboxImage.src = ''; 
        };

        heroLink.addEventListener('click', (e) => {
            e.preventDefault();
            openLightbox(heroLink.href);
        });

        lightboxClose.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                closeLightbox();
            }
        });
    });
</script>
        
</body></html>`;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: html
        };

    } catch (error) {
        console.error("Caught error in handler:", error);
        return { statusCode: 500, body: 'Server error fetching event details. Please try again later.' };
    }
};