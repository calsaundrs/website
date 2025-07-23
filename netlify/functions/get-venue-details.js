const Airtable = require('airtable');
const fetch = require('node-fetch');

const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

// Helper to get the effective "today" for event filtering (6 AM cutoff)
const getEffectiveToday = () => {
    const now = new Date();
    const effectiveToday = new Date(now);
    // If current time is before 6 AM, consider it part of the previous day for event filtering
    if (now.getHours() < 6) {
        effectiveToday.setDate(now.getDate() - 1);
    }
    effectiveToday.setHours(6, 0, 0, 0); // Set to 6 AM
    return effectiveToday;
};

// Helper function to create HTML for a list of tags in the sidebar
function createTagsHtml(tags, iconClass) {
    if (!tags || tags.length === 0) return '';
    const tagsHtml = tags.map(tag => `<span class="inline-flex items-center bg-gray-700/50 text-gray-300 text-sm font-semibold px-3 py-1 rounded-full"><i class="${iconClass} mr-2 opacity-60"></i>${tag}</span>`).join('');
    return `<div class="flex flex-wrap gap-2">${tagsHtml}</div>`;
}

// Helper function to create a generic section in the sidebar
function createSidebarSection(title, content, iconClass) {
    if (!content || (Array.isArray(content) && content.length === 0)) return '';
    return `
        <div class="border-t border-gray-700 pt-6">
            <h3 class="font-bold text-lg accent-color-secondary mb-3 flex items-center"><i class="${iconClass} mr-3 text-xl opacity-80"></i>${title}</h3>
            <div class="prose prose-invert prose-sm max-w-none text-gray-400">
                ${content}
            </div>
        </div>
    `;
}

// Creates gallery from photo data that has already been resolved to direct URLs
const cloudinaryCloudName = 'dbxhpjoiz'; // Your Cloudinary cloud name

const getCloudinaryUrl = (publicId, width, height) => {
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/f_auto,q_auto,w_${width},h_${height},c_limit/${publicId}`;
};

// Creates gallery from photo data that has already been resolved to direct URLs
function createGooglePhotoGalleryHtml(resolvedPhotos) {
    if (!resolvedPhotos || resolvedPhotos.length === 0) {
        return '';
    }
    const galleryItemsHtml = resolvedPhotos.map((photo, index) => `
        <a href="${photo.finalUrl}" class="gallery-image-link block rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-yellow-400" data-index="${index}" data-title="${photo.title}">
            <img src="${photo.finalUrl}" alt="${photo.title}" loading="lazy" class="w-full h-full object-cover aspect-square transition-transform duration-300 ease-in-out group-hover:scale-110">
        </a>
    `).join('');

    return `
        <div class="mt-16">
            <h2 class="font-bold text-3xl accent-color-secondary mb-6">Gallery</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                ${galleryItemsHtml}
            </div>
            <p class="text-xs text-gray-500 mt-4 text-center">
                Please note: these images are sourced from the venue's Google Places listing. We do not have control over which photos are displayed.
            </p>
        </div>
    `;
}

// *** NEW: Helper function to create a single event card ***
function createEventCardHtml(instance) {
    if (!instance) return '';

    const d = new Date(instance.Date);
    // Fallback for invalid dates
    const eventDate = !isNaN(d) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date TBC';
    const eventTime = !isNaN(d) ? d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' }) : '';

    const imageUrl = (instance['Cloudinary Processed'] && instance['Cloudinary Public ID'])
        ? getCloudinaryUrl(instance['Cloudinary Public ID'], 500, 281)
        : (instance['Promo Image'] && instance['Promo Image'].length > 0
            ? instance['Promo Image'][0].url
            : 'https://placehold.co/500x281/1a1a1a/f5efe6?text=Event');

    const recurringInfoPill =
        instance['Recurring Info']
            ? `<span class="absolute top-3 right-3 bg-accent-color text-white text-xs font-bold px-2 py-1 rounded-full">${instance['Recurring Info']}</span>`
            : '';

    return `
        <a href="/event/${instance.Slug}" class="suggested-card block rounded-xl overflow-hidden group bg-gray-800/50">
            <div class="relative">
                <img src="${imageUrl}" alt="${instance['Event Name']}" class="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105">
                ${recurringInfoPill}
            </div>
            <div class="p-4">
                <h4 class="font-bold text-white text-lg mb-1 truncate">${instance['Event Name']}</h4>
                <p class="text-sm text-gray-400">${eventDate}${eventTime ? ` - ${eventTime}` : ''}</p>
            </div>
        </a>
    `;
}

// Helper function to generate star rating HTML
function generateStars(rating) {
    let stars = '';
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    for (let i = 0; i < fullStars; i++) stars += '<i class="fas fa-star text-yellow-400"></i>';
    if (halfStar) stars += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) stars += '<i class="far fa-star text-yellow-400"></i>';
    return stars;
}

// Function to parse opening hours and determine status
function getOpeningStatus(openingHoursText) {
    if (!openingHoursText || openingHoursText === 'Not Available') { return { html: '' }; }
    const schedule = {};
    const dayIndexes = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
    const toMinutes = (timeStr, period) => {
        let [hour, minute] = timeStr.split(':').map(Number);
        minute = minute || 0;
        if (period.toLowerCase() === 'pm' && hour !== 12) hour += 12;
        if (period.toLowerCase() === 'am' && hour === 12) hour = 0;
        return hour * 60 + minute;
    };
    const lines = openingHoursText.split('<br>');
    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length < 2) continue;
        const dayPart = parts[0].trim();
        const timePart = parts[1].trim();
        const daysToApply = [];
        if (dayPart.includes('-')) {
            const [startDay, endDay] = dayPart.split('-').map(d => d.trim());
            let current = dayIndexes[startDay], end = dayIndexes[endDay];
            if (current === undefined || end === undefined) continue;
            while (true) { daysToApply.push(current); if (current === end) break; current = (current + 1) % 7; }
        } else {
            const dayIndex = dayIndexes[dayPart];
            if (dayIndex !== undefined) daysToApply.push(dayIndex);
        }
        daysToApply.forEach(dayIndex => { if (!schedule[dayIndex]) schedule[dayIndex] = []; });
        if (timePart.toLowerCase() === 'closed') {
            daysToApply.forEach(dayIndex => schedule[dayIndex].push({ isClosed: true }));
            continue;
        }
        const timeSlots = timePart.split(',');
        for (const slot of timeSlots) {
            const timeMatches = slot.trim().match(/(\d{1,2}(?::\d{2})?)(am|pm)\s*-\s*(\d{1,2}(?::\d{2})?)(am|pm)/i);
            if (!timeMatches) continue;
            let [, openTimeStr, openPeriod, closeTimeStr, closePeriod] = timeMatches;
            daysToApply.forEach(dayIndex => {
                schedule[dayIndex].push({ isClosed: false, opens: toMinutes(openTimeStr, openPeriod), closes: toMinutes(closeTimeStr, closePeriod), openDisplay: `${openTimeStr}${openPeriod}`, closeDisplay: `${closeTimeStr}${closePeriod}` });
            });
        }
    }
    const now = new Date();
    const londonTimeOpts = { timeZone: 'Europe/London' };
    const currentDayIndex = now.getDay();
    const prevDayIndex = (currentDayIndex + 6) % 7;
    const hour = parseInt(now.toLocaleString('en-GB', { ...londonTimeOpts, hour: '2-digit', hour12: false }), 10);
    const minute = parseInt(now.toLocaleString('en-GB', { ...londonTimeOpts, minute: '2-digit' }), 10);
    const currentTimeInMinutes = hour * 60 + minute;
    let status = 'Closed', message = 'Currently Closed', color = 'red';
    const checkStatus = () => {
        for (const slot of (schedule[prevDayIndex] || [])) {
            if (!slot.isClosed && slot.closes < slot.opens) { if (currentTimeInMinutes < slot.closes) { return { status: 'Open', message: `Open until ${slot.closeDisplay} (from yesterday)`, color: 'green' }; } }
        }
        for (const slot of (schedule[currentDayIndex] || [])) {
            if (slot.isClosed) continue;
            let isOpenNow;
            if (slot.closes > slot.opens) { isOpenNow = (currentTimeInMinutes >= slot.opens && currentTimeInMinutes < slot.closes); } else { isOpenNow = (currentTimeInMinutes >= slot.opens || currentTimeInMinutes < slot.closes); }
            if (isOpenNow) { return { status: 'Open', message: `Open until ${slot.closeDisplay}`, color: 'green' }; }
        }
        return null;
    };
    const currentStatus = checkStatus();
    if (currentStatus) {
        ({ status, message, color } = currentStatus);
    } else {
        for (const slot of (schedule[currentDayIndex] || [])) {
             if (!slot.isClosed && currentTimeInMinutes < slot.opens && (slot.opens - currentTimeInMinutes <= 60)) { status = 'Opens Soon'; message = `Opens at ${slot.openDisplay}`; color = 'orange'; break; }
        }
    }
    const colorClasses = { red: 'bg-red-500/10 text-red-400 border-red-500/30', green: 'bg-green-500/10 text-green-400 border-green-500/30', orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
    return { html: `<div class="p-3 rounded-lg border text-center ${colorClasses[color]} mb-6"><p class="font-bold text-lg">${status}</p><p class="text-sm">${message}</p></div>` };
}

exports.handler = async function (event, context) {
    const slug = event.path.split("/").pop();
    if (!slug) { return { statusCode: 400, body: 'Venue slug not provided.' }; }

    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

    try {
        const venueRecords = await base('Venues').select({
            maxRecords: 1,
            filterByFormula: `{Slug} = "${slug}"`,
            fields: [ "Name", "Description", "Address", "Opening Hours", "Accessibility", "Website", "Instagram", "Facebook", "TikTok", "Photo", "Photo URL", "Photo Thumbnail URL", "Photo Medium URL", "Google Place ID", "Vibe Tags", "Venue Features", "Accessibility Rating", "Accessibility Features", "Parking Exception", "Events" ]
        }).all();

        if (!venueRecords || venueRecords.length === 0) { return { statusCode: 404, body: 'Venue not found.' }; }

        const venueRecord = venueRecords[0];
        const venue = venueRecord.fields;
        const venueRecordId = venueRecord.id;

        let upcomingEventsHtml = '';
        let recurringEventsHTML = '';
        let oneOffEventsHTML = '';
        const eventRecordIds = venue['Events']; 

        if (eventRecordIds && eventRecordIds.length > 0) {
            try {
                const eventFilterFormula = `OR(${eventRecordIds.map(id => `RECORD_ID() = '${id}'`).join(',')})`;
                const effectiveToday = getEffectiveToday();
                const finalFilter = `AND(${eventFilterFormula}, IS_AFTER({Date}, DATETIME_PARSE('${effectiveToday.toISOString().split('T')[0]}', 'YYYY-MM-DD')))`

                const eventRecords = await base('Events').select({
                    filterByFormula: finalFilter,
                    sort: [{ field: 'Date', direction: 'asc' }],
                    fields: ["Event Name", "Date", "Slug", "Recurring Info", "Cloudinary Public ID", "Cloudinary Processed", "Promo Image"]
                }).all();

                if (eventRecords && eventRecords.length > 0) {
                    const allEvents = eventRecords.map(r => r.fields);
                    const recurringEvents = allEvents.filter(e => e['Recurring Info']);
                    const oneOffEvents = allEvents.filter(e => !e['Recurring Info']);

                    // --- UPDATED: Use the new card helper and wrap in a grid ---
                    recurringEventsHTML = recurringEvents.length > 0 
                        ? recurringEvents.slice(0, 4).map(createEventCardHtml).join('') 
                        : '';

                    oneOffEventsHTML = oneOffEvents.length > 0 
                        ? oneOffEvents.slice(0, 4).map(createEventCardHtml).join('') 
                        : '';

                    upcomingEventsHtml = `
                        ${recurringEventsHTML ? `
                        <div class="mt-16">
                            <h2 class="font-bold text-3xl accent-color-secondary mb-6">Regular Events</h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${recurringEventsHTML}</div>
                        </div>` : ''}

                        ${oneOffEventsHTML ? `
                        <div class="mt-16">
                            <h2 class="font-bold text-3xl accent-color-secondary mb-6">Upcoming Events</h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${oneOffEventsHTML}</div>
                        </div>` : ''}
                    `;
                }
            } catch (err) {
                console.error("Error fetching linked events for venue:", err);
                upcomingEventsHtml = '';
                recurringEventsHTML = '';
                oneOffEventsHTML = '';
            }
        }
        
        let placeId = venue['Google Place ID'];
        let googleRatingHtml = '';
        let googleReviewsHtml = '';
        let photoGalleryHtml = '';
        let googlePhotosData = '[]';
        let googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.Name + ', ' + venue.Address)}${placeId ? `&query_place_id=${placeId}` : ''}`;

        if (GOOGLE_PLACES_API_KEY) {
            if (!placeId) {
                const findPlaceQuery = encodeURIComponent(`${venue.Name}, ${venue.Address}`);
                const findPlaceUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${findPlaceQuery}&inputtype=textquery&fields=place_id&key=${GOOGLE_PLACES_API_KEY}`;
                try {
                    const findPlaceResponse = await fetch(findPlaceUrl);
                    const findPlaceData = await findPlaceResponse.json();
                    if (findPlaceData.status === 'OK' && findPlaceData.candidates.length > 0) {
                        placeId = findPlaceData.candidates[0].place_id;
                        await base('Venues').update([{ id: venueRecordId, fields: { "Google Place ID": placeId } }]);
                    }
                } catch (error) { console.error("Error finding place ID:", error); }
            }

            if (placeId) {
                const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,reviews,url,photos&key=${GOOGLE_PLACES_API_KEY}`;
                try {
                    const placeDetailsResponse = await fetch(placeDetailsUrl);
                    const placeDetailsData = await placeDetailsResponse.json();
                    if (placeDetailsData.status === 'OK' && placeDetailsData.result) {
                        const { rating, user_ratings_total, reviews, url, photos } = placeDetailsData.result;
                        if(url) googleMapsUrl = url;
                        if (rating) {
                            googleRatingHtml = createSidebarSection( 'Google Rating', `<div class="flex items-center space-x-2 text-xl"><div>${generateStars(rating)}</div><p class="text-white font-semibold">${rating} <span class="text-gray-400">(${user_ratings_total})</span></p></div> <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline text-sm mt-1 block">View on Google Maps</a>`, 'fab fa-google' );
                        }
                        if (reviews && reviews.length > 0) {
                            googleReviewsHtml = `<div class="mt-24"><h2 class="font-anton text-5xl text-white mb-8">Recent Reviews from Google</h2><div class="space-y-4">${reviews.slice(0, 3).map(review => { const reviewStars = generateStars(review.rating); let reviewText = review.text; let readMoreLink = ''; if (reviewText.length > 280) { reviewText = reviewText.substring(0, 280) + '...'; readMoreLink = `<a href="${googleMapsUrl}" target="_blank" class="text-blue-400 hover:underline text-xs">Read more on Google</a>`; } return `<div class="card-bg p-4 space-y-2"><div class="flex items-center justify-between"><p class="font-semibold text-white">${review.author_name}</p><div class="text-xs">${reviewStars}</div></div><p class="text-gray-300 text-sm">${reviewText}</p>${readMoreLink}</div>` }).join('')}<div class="mt-8 text-center"><img src="https://www.gstatic.com/marketing-cms/assets/images/c5/3a/200414104c669203c62270f7884f/google-wordmarks-2x.webp" alt="Powered by Google" style="max-width:120px; height: auto; margin: 0 auto;"></div></div></div>`;
                        }
                        if (photos) {
                            const photoPromises = photos.slice(0, 8).map(async (photo) => {
                                const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1920&photo_reference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
                                try {
                                    const photoResponse = await fetch(photoApiUrl, { redirect: 'manual' });
                                    const finalUrl = photoResponse.headers.get('location');
                                    if (finalUrl) { return { finalUrl: finalUrl, title: photo.html_attributions[0].replace(/<[^>]*>/g, '') || 'Venue Photo' }; } 
                                } catch (e) { console.error("Could not resolve photo URL", e); return null; }
                            });
                            const resolvedPhotos = (await Promise.all(photoPromises)).filter(p => p !== null);
                            googlePhotosData = JSON.stringify(resolvedPhotos);
                            photoGalleryHtml = createGooglePhotoGalleryHtml(resolvedPhotos);
                        }
                    }
                } catch (error) { console.error("Error fetching place details:", error); }
            }
        }

        const mainPhoto = venue['Photo URL'] || 'https://placehold.co/1200x675/1a1a1a/f5efe6?text=Venue+Photo';
        const description = venue['Description'] || 'No description provided.';
        const openingHoursText = venue['Opening Hours'] ? venue['Opening Hours'].replace(/\n/g, '<br>') : 'Not Available';
        const openingStatus = getOpeningStatus(openingHoursText);
        const openingHoursContent = openingHoursText;
        const vibeTagsHtml = createTagsHtml(venue['Vibe Tags'], 'fa-solid fa-martini-glass-citrus');
        const venueFeaturesHtml = createTagsHtml(venue['Venue Features'], 'fa-solid fa-star');
        let accessibilityInfo = [];
        if (venue['Accessibility Rating']) accessibilityInfo.push(`<strong>Rating:</strong> ${venue['Accessibility Rating']}`);
        if (venue['Accessibility Features']) accessibilityInfo.push(`<strong>Features:</strong> ${venue['Accessibility Features'].join(', ')}`);
        if (venue['Accessibility']) accessibilityInfo.push(venue['Accessibility']);
        if (venue['Parking Exception']) accessibilityInfo.push(`<strong>Parking:</strong> ${venue['Parking Exception']}`);
        const accessibilityHtml = accessibilityInfo.length > 0 ? accessibilityInfo.join('<br><br>') : 'No specific accessibility information has been provided.';
        
        const html = `<!DOCTYPE html><html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${venue.Name} | Brum Outloud</title>
    <meta name="description" content="Explore ${venue.Name}, an LGBTQ+ friendly venue in Birmingham. Find details on its vibe, features, accessibility, and more on Brum Outloud.">
    <link rel="canonical" href="${process.env.URL || 'https://www.brumoutloud.co.uk'}/venue/${slug}">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="/css/main.css">
    <script src="/js/main.js" defer></script>
    <style>
        /* Fixed hero image styles - removed light gradient effect */
        .hero-image-container { 
            position: relative; 
            width: 100%; 
            aspect-ratio: 16 / 9; 
            background-color: #1e1e1e; 
            overflow: hidden; 
            border-radius: 1.25rem; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3); 
        } 
        .hero-image-bg { 
            position: absolute; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            object-fit: cover; 
            opacity: 0; 
            filter: blur(24px) brightness(0.3); 
            transform: scale(1.1); 
            transition: opacity 0.4s ease; 
        } 
        .hero-image-container:hover .hero-image-bg { 
            opacity: 1; 
        } 
        .hero-image-fg { 
            position: relative; 
            width: 100%; 
            height: 100%; 
            object-fit: cover; 
            z-index: 10; 
            transition: all 0.4s ease; 
        } 
        .hero-image-container:hover .hero-image-fg { 
            object-fit: contain; 
            transform: scale(0.9); 
        } 
        
        /* Mobile-first responsive design */
        @media (max-width: 768px) {
            .hero-image-container {
                aspect-ratio: 4 / 3;
                border-radius: 0;
                margin: 0 -1rem;
                width: calc(100% + 2rem);
            }
            
            .mobile-venue-header {
                padding: 1rem;
                margin: 0 -1rem;
            }
            
            .mobile-content {
                padding-bottom: 6rem; /* Space for sticky bottom bar */
            }
            
            .sticky-bottom-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(17, 24, 39, 0.95);
                backdrop-filter: blur(10px);
                border-top: 1px solid rgba(75, 85, 99, 0.5);
                padding: 1rem;
                z-index: 50;
            }
        }
        
        .suggested-card { 
            border-radius: 1.25rem; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3); 
            background-color: #1e1e1e; 
            transition: transform 0.3s ease, box-shadow 0.3s ease; 
        } 
        .suggested-card:hover { 
            transform: translateY(-5px); 
            box-shadow: 0 15px 40px rgba(0,0,0,0.5); 
        } 
        .suggested-carousel { 
            scroll-snap-type: x mandatory; 
            -webkit-overflow-scrolling: touch; 
            overflow-x: auto; 
            padding-bottom: 1rem; 
            scrollbar-width: thin; 
            scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.1); 
        } 
        .suggested-carousel::-webkit-scrollbar { 
            height: 4px; 
        } 
        .suggested-carousel::-webkit-scrollbar-track { 
            background: rgba(0, 0, 0, 0.1); 
            border-radius: 2px; 
        } 
        .suggested-carousel::-webkit-scrollbar-thumb { 
            background: rgba(255, 255, 255, 0.3); 
            border-radius: 2px; 
        } 
        
        .custom-lightbox { 
            display: none; 
            position: fixed; 
            z-index: 9999; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background-color: rgba(0,0,0,0.85); 
            justify-content: center; 
            align-items: center; 
            padding: 15px; 
        }
        .custom-lightbox.active { 
            display: flex; 
        }
        .custom-lightbox-content { 
            position: relative; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            width: 100%; 
            height: 100%;
        }
        .custom-lightbox-image { 
            width: auto; 
            height: auto; 
            max-width: 95vw; 
            max-height: 85vh; 
            object-fit: contain; 
            border-radius: 1rem; 
        }
        .custom-lightbox-close, .custom-lightbox-prev, .custom-lightbox-next { 
            cursor: pointer; 
            position: absolute; 
            color: white; 
            background-color: rgba(0,0,0,0.5); 
            border-radius: 50%; 
            width: 44px; 
            height: 44px; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            font-size: 24px; 
            user-select: none; 
            transition: background-color 0.2s; 
            z-index: 10000; 
        }
        .custom-lightbox-close:hover, .custom-lightbox-prev:hover, .custom-lightbox-next:hover { 
            background-color: rgba(0,0,0,0.8); 
        }
        .custom-lightbox-close { 
            top: 15px; 
            right: 15px; 
        }
        .custom-lightbox-prev { 
            left: 15px; 
            top: 50%; 
            transform: translateY(-50%); 
        }
        .custom-lightbox-next { 
            right: 15px; 
            top: 50%; 
            transform: translateY(-50%); 
        }
        .custom-lightbox-title { 
            text-align: center; 
            color: white; 
            padding: 10px; 
            font-family: 'Poppins', sans-serif; 
            font-size: 0.9rem; 
            max-width: 80vw; 
        }
    </style>
    <link rel="icon" href="/faviconV2.png" type="image/png">
    <link rel="manifest" href="/manifest.json">
</head>
<body class="antialiased">
    <div id="header-placeholder"></div>
    
    <!-- Desktop Layout -->
    <div class="hidden lg:block">
        <main class="container mx-auto px-8 py-16">
            <div class="grid lg:grid-cols-3 gap-16">
                <div class="lg:col-span-2">
                    <div class="hero-image-container mb-8">
                        <img src="${mainPhoto}" alt="" class="hero-image-bg" aria-hidden="true">
                        <img src="${mainPhoto}" alt="${venue.Name}" class="hero-image-fg">
                    </div>
                    <p class="font-semibold accent-color mb-2">VENUE DETAILS</p>
                    <h1 class="font-anton text-6xl lg:text-8xl heading-gradient leading-none mb-8">${venue.Name}</h1>
                    <div class="prose prose-invert prose-lg max-w-none text-gray-300">${description.replace(/\n/g, '<br>')}</div>
                    ${upcomingEventsHtml}
                    ${photoGalleryHtml}
                </div>
                <div class="lg:col-span-1">
                    <div class="card-bg p-8 sticky top-8 space-y-6">
                        <div><h3 class="font-bold text-lg accent-color-secondary mb-2">Current Status</h3>${openingStatus.html}</div>
                        <div><h3 class="font-bold text-lg accent-color-secondary mb-2">Location</h3><p class="text-2xl font-semibold">${venue.Address}</p><a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="text-sm text-accent-color hover:underline">Get Directions</a></div>
                        ${createSidebarSection('Opening Hours', openingHoursContent, 'fa-solid fa-clock')}
                        ${createSidebarSection('The Vibe', vibeTagsHtml, 'fa-solid fa-martini-glass-citrus')}
                        ${createSidebarSection('Venue Features', venueFeaturesHtml, 'fa-solid fa-star')}
                        ${createSidebarSection('Accessibility', accessibilityHtml, 'fa-solid fa-universal-access')}
                        ${googleRatingHtml}
                        <div class="border-t border-gray-700 pt-6">
                            <h3 class="font-bold text-lg accent-color-secondary mb-4 text-center">Contact & Social</h3>
                            <div class="grid grid-cols-1 gap-2">${venue.Website ? `<a href="${venue.Website}" target="_blank" class="social-button flex-grow"><i class="fas fa-globe mr-2"></i>Website</a>` : ''}${venue.Instagram ? `<a href="${venue.Instagram}" target="_blank" class="social-button flex-grow"><i class="fab fa-instagram mr-2"></i>Instagram</a>` : ''}${venue.Facebook ? `<a href="${venue.Facebook}" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600">Facebook</a>` : ''}${venue.TikTok ? `<a href="${venue.TikTok}" target="_blank" rel="noopener noreferrer" class="block w-full text-center bg-gray-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600">TikTok</a>` : ''}</div>
                        </div>
                    </div>
                </div>
            </div>
            ${googleReviewsHtml}
        </main>
    </div>
    
    <!-- Mobile Layout -->
    <div class="lg:hidden">
        <!-- Mobile Hero Image -->
        <div class="hero-image-container">
            <img src="${mainPhoto}" alt="${venue.Name}" class="hero-image-fg">
            <div class="absolute top-3 right-3">
                <button class="btn-secondary text-white px-2 py-1 rounded text-xs">
                    <i class="fas fa-share"></i>
                </button>
            </div>
        </div>
        
        <!-- Mobile Venue Header -->
        <div class="mobile-venue-header">
            <h1 class="text-2xl font-bold text-white mb-2">${venue.Name}</h1>
            <p class="text-gray-300 text-sm mb-3">
                <i class="fas fa-map-marker-alt mr-1 text-accent-color"></i>
                ${venue.Address}
            </p>
            <div class="flex flex-wrap gap-1 mb-4">
                ${vibeTagsHtml ? vibeTagsHtml.replace(/<div class="flex flex-wrap gap-2">|<\/div>/g, '') : ''}
                ${venueFeaturesHtml ? venueFeaturesHtml.replace(/<div class="flex flex-wrap gap-2">|<\/div>/g, '') : ''}
            </div>
        </div>
        
        <!-- Mobile Content Sections -->
        <div class="mobile-content px-4 space-y-6">
            <!-- Current Status Card -->
            <div class="venue-card p-4">
                <h3 class="text-lg font-bold text-white mb-3">
                    <i class="fas fa-clock mr-2 text-accent-color"></i>Current Status
                </h3>
                ${openingStatus.html}
            </div>
            
            <!-- About Section -->
            <div class="venue-card p-4">
                <h2 class="text-xl font-bold text-white mb-3">
                    <i class="fas fa-info-circle mr-2 text-accent-color"></i>About This Venue
                </h2>
                <p class="text-gray-300 text-sm leading-relaxed">${description.replace(/\n/g, '<br>')}</p>
            </div>
            
            <!-- Opening Hours Card -->
            <div class="venue-card p-4">
                <h3 class="text-lg font-bold text-white mb-3">
                    <i class="fas fa-clock mr-2 text-accent-color"></i>Opening Hours
                </h3>
                <div class="prose prose-invert prose-sm max-w-none text-gray-300">${openingHoursContent}</div>
            </div>
            
            <!-- The Vibe Card -->
            ${vibeTagsHtml ? `<div class="venue-card p-4">
                <h3 class="text-lg font-bold text-white mb-3">
                    <i class="fas fa-martini-glass-citrus mr-2 text-accent-color"></i>The Vibe
                </h3>
                ${vibeTagsHtml}
            </div>` : ''}
            
            <!-- Venue Features Card -->
            ${venueFeaturesHtml ? `<div class="venue-card p-4">
                <h3 class="text-lg font-bold text-white mb-3">
                    <i class="fas fa-star mr-2 text-accent-color"></i>Venue Features
                </h3>
                ${venueFeaturesHtml}
            </div>` : ''}
            
            <!-- Accessibility Card -->
            <div class="venue-card p-4">
                <h3 class="text-lg font-bold text-white mb-3">
                    <i class="fas fa-universal-access mr-2 text-accent-color"></i>Accessibility
                </h3>
                <div class="prose prose-invert prose-sm max-w-none text-gray-300">${accessibilityHtml}</div>
            </div>
            
            <!-- Google Rating Card -->
            ${googleRatingHtml ? `<div class="venue-card p-4">
                <h3 class="text-lg font-bold text-white mb-3">
                    <i class="fab fa-google mr-2 text-accent-color"></i>Google Rating
                </h3>
                ${googleRatingHtml.replace(/<div class="border-t border-gray-700 pt-6">|<\/div>/g, '')}
            </div>` : ''}
            
            <!-- Contact Info Card -->
            <div class="venue-card p-4">
                <h3 class="text-lg font-bold text-white mb-3">
                    <i class="fas fa-address-card mr-2 text-accent-color"></i>Contact Information
                </h3>
                <div class="space-y-3">
                    ${venue.Website ? `<div class="flex items-center gap-3 text-gray-400">
                        <i class="fas fa-globe w-5"></i>
                        <a href="${venue.Website}" target="_blank" class="text-accent-color hover:underline text-sm">${venue.Website.replace(/^https?:\/\//, '')}</a>
                    </div>` : ''}
                    ${venue.Instagram ? `<div class="flex items-center gap-3 text-gray-400">
                        <i class="fab fa-instagram w-5"></i>
                        <a href="${venue.Instagram}" target="_blank" class="text-accent-color hover:underline text-sm">Instagram</a>
                    </div>` : ''}
                    ${venue.Facebook ? `<div class="flex items-center gap-3 text-gray-400">
                        <i class="fab fa-facebook w-5"></i>
                        <a href="${venue.Facebook}" target="_blank" class="text-accent-color hover:underline text-sm">Facebook</a>
                    </div>` : ''}
                    ${venue.TikTok ? `<div class="flex items-center gap-3 text-gray-400">
                        <i class="fab fa-tiktok w-5"></i>
                        <a href="${venue.TikTok}" target="_blank" class="text-accent-color hover:underline text-sm">TikTok</a>
                    </div>` : ''}
                </div>
            </div>
            
            <!-- Regular Events -->
            ${recurringEventsHTML ? `<div class="venue-card p-6">
                <h2 class="text-2xl font-bold text-white mb-4">
                    <i class="fas fa-redo mr-3 text-accent-color"></i>Regular Events
                </h2>
                <div class="space-y-4">${recurringEventsHTML}</div>
            </div>` : ''}
            
            <!-- Upcoming One-Off Events -->
            ${oneOffEventsHTML ? `<div class="venue-card p-6">
                <h2 class="text-2xl font-bold text-white mb-4">
                    <i class="fas fa-calendar mr-3 text-accent-color"></i>Upcoming Special Events
                </h2>
                <div class="space-y-4">${oneOffEventsHTML}</div>
            </div>` : ''}
            
            <!-- Gallery -->
            ${photoGalleryHtml ? `<div class="venue-card p-4">
                <h2 class="text-2xl font-bold text-white mb-4">
                    <i class="fas fa-images mr-3 text-accent-color"></i>Gallery
                </h2>
                ${photoGalleryHtml.replace(/<div class="mt-16">|<\/div>/g, '')}
            </div>` : ''}
            
            <!-- Google Reviews -->
            ${googleReviewsHtml ? `<div class="venue-card p-4">
                ${googleReviewsHtml.replace(/<div class="mt-24">|<\/div>/g, '')}
            </div>` : ''}
        </div>
        
        <!-- Mobile Action Buttons - Sticky Bottom -->
        <div class="sticky-bottom-bar">
            <div class="flex gap-2">
                <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary text-white flex-1 py-3 px-4 rounded-lg font-bold text-sm">
                    <i class="fas fa-map-marker-alt mr-1"></i>Get Directions
                </a>
                ${venue.Website ? `<a href="${venue.Website}" target="_blank" class="btn-secondary text-white px-4 py-3 rounded-lg font-bold text-sm">
                    <i class="fas fa-globe"></i>
                </a>` : ''}
                <button class="btn-secondary text-white px-4 py-3 rounded-lg font-bold text-sm">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
        </div>
    </div>
    
    <div id="footer-placeholder"></div>

    <div id="custom-lightbox" class="custom-lightbox">
        <span id="custom-lightbox-close" class="custom-lightbox-close">×</span>
        <span id="custom-lightbox-prev" class="custom-lightbox-prev"><</span>
        <span id="custom-lightbox-next" class="custom-lightbox-next">></span>
        <div class="custom-lightbox-content">
            <img id="custom-lightbox-image" class="custom-lightbox-image" src="">
            <div id="custom-lightbox-title" class="custom-lightbox-title"></div>
        </div>
    </div>

    <script>
    // Load header and footer
    async function loadHeaderFooter() {
        try {
            const headerResponse = await fetch('/global/header.html');
            const footerResponse = await fetch('/global/footer.html');
            
            if (headerResponse.ok) {
                const headerHtml = await headerResponse.text();
                document.getElementById('header-placeholder').innerHTML = headerHtml;
            }
            
            if (footerResponse.ok) {
                const footerHtml = await footerResponse.text();
                document.getElementById('footer-placeholder').innerHTML = footerHtml;
            }
        } catch (error) {
            console.error('Error loading header/footer:', error);
        }
    }
    
    // Load header and footer when page loads
    loadHeaderFooter();
    
    document.addEventListener('DOMContentLoaded', () => {
        const galleryImages = ${googlePhotosData};
        if (galleryImages.length === 0) return;

        const lightbox = document.getElementById('custom-lightbox');
        const lightboxImage = document.getElementById('custom-lightbox-image');
        const lightboxTitle = document.getElementById('custom-lightbox-title');
        const closeBtn = document.getElementById('custom-lightbox-close');
        const prevBtn = document.getElementById('custom-lightbox-prev');
        const nextBtn = document.getElementById('custom-lightbox-next');
        
        let currentIndex = 0;

        function showImage(index) {
            const image = galleryImages[index];
            lightboxImage.src = image.finalUrl;
            lightboxTitle.textContent = image.title;
            currentIndex = index;
        }

        function openLightbox(index) {
            showImage(index);
            lightbox.classList.add('active');
        }

        function closeLightbox() {
            lightbox.classList.remove('active');
        }

        function showPrev() {
            currentIndex = (currentIndex === 0) ? galleryImages.length - 1 : currentIndex - 1;
            showImage(currentIndex);
        }

        function showNext() {
            currentIndex = (currentIndex === galleryImages.length - 1) ? 0 : currentIndex + 1;
            showImage(currentIndex);
        }

        document.querySelectorAll('.gallery-image-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(e.currentTarget.dataset.index, 10);
                openLightbox(index);
            });
        });

        closeBtn.addEventListener('click', closeLightbox);
        prevBtn.addEventListener('click', showPrev);
        nextBtn.addEventListener('click', showNext);
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') showPrev();
            if (e.key === 'ArrowRight') showNext();
        });
    });
    </script>
</body>
</html>`;

        return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
    } catch (error) {
        console.error("Server error building venue page:", error);
        return { statusCode: 500, body: `Server error building venue page. Error: ${error.toString()}` };
    }
};