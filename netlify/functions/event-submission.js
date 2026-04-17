const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const RecurringEventsManager = require('./services/recurring-events-manager');
const EmailService = require('./services/email-service');
const multipart = require('lambda-multipart-parser');
const { verify: verifyResubmitToken } = require('./utils/resubmit-token');

// AI Poster Parsing Function
async function parsePosterWithAI(imageUrl, geminiModel = 'gemini-1.5-flash') {
    try {
        console.log('🤖 Starting AI poster parsing for:', imageUrl);
        
        const prompt = `Analyze this event poster and extract the following information in JSON format:
{
  "eventName": "The name of the event",
  "date": "Event date in YYYY-MM-DD format if found",
  "time": "Event time in HH:MM format if found", 
  "venue": "Venue name if found",
  "description": "Brief description or tagline if found",
  "price": "Price information if found",
  "ageRestriction": "Age restriction if found",
  "categories": ["array", "of", "relevant", "categories"],
  "confidence": "high/medium/low based on how clear the information is"
}

Only return valid JSON. If information is not found, use null for that field. Be conservative - only extract information you're confident about.`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageUrl.split(',')[1] || imageUrl // Handle both data URLs and direct URLs
                        }
                    }
                ]
            }]
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AI API Error Response:", errorBody);
            throw new Error(`AI API call failed with status: ${response.status}`);
        }

        const data = await response.json();
        const extractedText = data.candidates[0].content.parts[0].text.trim();
        
        // Try to parse the JSON response
        try {
            const parsedData = JSON.parse(extractedText);
            console.log('🤖 AI extracted data:', parsedData);
            return parsedData;
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', extractedText);
            return null;
        }

    } catch (error) {
        console.error('AI poster parsing failed:', error);
        return null;
    }
}

exports.handler = async function (event, context) {
    console.log('Firestore-only event submission called');
    
    try {
        // Check environment variables
        const required = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY',
            'CLOUDINARY_CLOUD_NAME',
            'CLOUDINARY_API_KEY',
            'CLOUDINARY_API_SECRET'
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
        
        // Initialize Cloudinary
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        // Parse form data
        let submission = {};
        let imageBuffer = null;
        let imageFileName = null;
        let imageContentType = null;
        
        try {
            const headers = event.headers || {};
            const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
            
            if (contentType.includes('multipart/form-data')) {
                const parsed = await multipart.parse(event);
                const { files = [], ...fields } = parsed || {};
                submission = fields || {};
                
                const imageFile = files.find(f => f.fieldname === 'image' || f.fieldname === 'promo-image' || f.name === 'image' || f.name === 'promo-image') || files[0];
                if (imageFile && imageFile.content && imageFile.content.length) {
                    imageBuffer = Buffer.from(imageFile.content);
                    imageFileName = imageFile.filename || imageFile.fileName || 'upload.jpg';
                    imageContentType = imageFile.contentType || 'image/jpeg';
                }
            } else if (contentType.includes('application/x-www-form-urlencoded')) {
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
                const params = new URLSearchParams(rawBody);
                for (const [key, value] of params) {
                    submission[key] = value;
                }
            } else if (contentType.includes('application/json')) {
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}');
                submission = JSON.parse(rawBody || '{}');
            } else {
                // Fallback: try urlencoded
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
                const params = new URLSearchParams(rawBody);
                for (const [key, value] of params) {
                    submission[key] = value;
                }
            }
            
            console.log('Form data parsed successfully');
            console.log('Category field:', submission['category-select']);
            console.log('Image file:', imageFileName ? { name: imageFileName, size: imageBuffer?.length } : 'No image');
            
        } catch (parseError) {
            console.error('Error parsing form data:', parseError);
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Failed to parse form data',
                    message: parseError.message
                })
            };
        }
        
        // Handle image upload and AI parsing
        console.log('Processing image upload...');
        let uploadedImage = null;
        let aiExtractedData = null;
        
        if (imageBuffer && imageFileName) {
            try {
                // Convert buffer to base64 string for Cloudinary
                const base64Image = imageBuffer.toString('base64');
                const dataURI = `data:${imageContentType};base64,${base64Image}`;
                
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: 'events',
                    transformation: [
                        { width: 800, height: 400, crop: 'fill', gravity: 'auto' },
                        { quality: 'auto', fetch_format: 'auto' }
                    ]
                });
                
                uploadedImage = {
                    publicId: result.public_id,
                    url: result.secure_url,
                    original: result.secure_url
                };
                console.log('Image uploaded successfully:', uploadedImage.publicId);
                
                // Parse poster with AI if Gemini API key is available
                if (process.env.GEMINI_API_KEY) {
                    try {
                        aiExtractedData = await parsePosterWithAI(dataURI);
                        console.log('AI parsing completed:', aiExtractedData ? 'Success' : 'Failed');
                    } catch (aiError) {
                        console.error('AI parsing failed, continuing without extracted data:', aiError);
                    }
                } else {
                    console.log('GEMINI_API_KEY not available, skipping AI parsing');
                }
                
            } catch (uploadError) {
                console.error('Image upload failed:', uploadError);
                // Continue without image
            }
        }
        
        // Use AI extracted data to pre-fill fields if available and not already provided
        const aiEventName = aiExtractedData?.eventName && !submission['event-name'] ? aiExtractedData.eventName : null;
        const aiDate = aiExtractedData?.date && !submission.date ? aiExtractedData.date : null;
        const aiTime = aiExtractedData?.time && !submission['start-time'] ? aiExtractedData.time : null;
        const aiVenue = aiExtractedData?.venue && !submission['venue-name'] ? aiExtractedData.venue : null;
        const aiDescription = aiExtractedData?.description && !submission.description ? aiExtractedData.description : null;
        const aiPrice = aiExtractedData?.price && !submission.price ? aiExtractedData.price : null;
        const aiAgeRestriction = aiExtractedData?.ageRestriction && !submission['age-restriction'] ? aiExtractedData.ageRestriction : null;
        const aiCategories = aiExtractedData?.categories && !submission.category ? aiExtractedData.categories : null;
        
        // Generate slug and validate required fields
        const eventName = submission['event-name'] || aiEventName || submission.name || '';
        const dateStr = submission.date || aiDate || '';
        const startTimeStr = submission['start-time'] || aiTime || '00:00';
        const venueIdSubmitted = submission['venue-id'] || submission.venueId || submission['venueId'] || null;
        
        if (!eventName) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Validation error', message: 'Missing event name' })
            };
        }
        if (!dateStr) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Validation error', message: 'Missing event date' })
            };
        }
        
        // Create date in UK timezone
        // Since this is a UK site, all times should be treated as UK time
        const constructedDate = new Date(`${dateStr}T${startTimeStr}:00`);
        if (isNaN(constructedDate.getTime())) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Validation error', message: 'Invalid date or time' })
            };
        }
        
        // Debug: Log the timezone information
        console.log('Date construction debug:', {
            dateStr,
            startTimeStr,
            constructedDate: constructedDate.toString(),
            constructedDateISO: constructedDate.toISOString(),
            timezoneOffset: constructedDate.getTimezoneOffset(),
            isDST: constructedDate.getTimezoneOffset() < new Date(constructedDate.getFullYear(), 0, 1).getTimezoneOffset()
        });
        
        // For UK events, we want to preserve the time as entered
        // The server runs in UTC, but we want to store the time as if it's UK time
        // We'll create a proper UK timezone date
        const ukDate = new Date(`${dateStr}T${startTimeStr}:00+00:00`); // Treat as GMT/UTC
        const eventDateIso = ukDate.toISOString();
        
        console.log('UK timezone fix:', {
            originalTime: `${dateStr}T${startTimeStr}:00`,
            ukDate: ukDate.toString(),
            finalISO: eventDateIso
        });
        const slug = generateSlug(eventName, dateStr);
        
        // Handle venue linking
        let venueData = {
            venueId: null,
            venueName: '',
            venueAddress: '',
            venueSlug: ''
        };
        
        if (venueIdSubmitted && venueIdSubmitted !== 'new') {
            // Existing venue selected
            try {
                const venueDoc = await db.collection('venues').doc(venueIdSubmitted).get();
                if (venueDoc.exists) {
                    const venue = venueDoc.data();
                    venueData = {
                        venueId: venueIdSubmitted,
                        venueName: venue.name || venue['Name'] || '',
                        venueAddress: venue.address || venue['Address'] || '',
                        venueSlug: venue.slug || ''
                    };
                } else {
                    console.warn(`Venue ID ${venueIdSubmitted} not found, falling back to text input`);
                    venueData.venueName = submission['venue-name'] || '';
                }
            } catch (venueError) {
                console.error('Error fetching venue:', venueError);
                venueData.venueName = submission['venue-name'] || '';
            }
        } else if (submission['new-venue-name']) {
            // New venue being created
            venueData.venueName = submission['new-venue-name'];
            venueData.venueAddress = submission['new-venue-address'] || '';
            
            // Create new venue record
            const newVenueData = {
                name: submission['new-venue-name'],
                address: submission['new-venue-address'] || '',
                postcode: submission['new-venue-postcode'] || '',
                website: submission['new-venue-website'] || '',
                slug: generateVenueSlug(submission['new-venue-name']),
                status: 'pending',
                submittedBy: submission.email || 'anonymous@brumoutloud.co.uk',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const newVenueRef = await db.collection('venues').add(newVenueData);
            venueData.venueId = newVenueRef.id;
            venueData.venueSlug = newVenueData.slug;
            
            console.log(`New venue created with ID: ${newVenueRef.id}`);
        } else {
            // Fallback to text input
            venueData.venueName = submission['venue-name'] || '';
        }
        
        // Prepare Firestore data
        const firestoreData = {
            // Core Fields (Standardized)
            name: submission['event-name'] || aiEventName || 'Untitled Event',
            slug: slug,
            description: submission.description || aiDescription || '',
            date: eventDateIso, // Keep for backward compatibility and sorting
            eventDate: dateStr, // Separate date field
            eventTime: startTimeStr, // Separate time field
            status: 'pending',
            
            // Venue Fields (Standardized)
            venueId: venueData.venueId,
            venueName: venueData.venueName,
            venueAddress: venueData.venueAddress,
            venueSlug: venueData.venueSlug,
            
            // Categorization (Standardized)
            category: getCategories(submission, aiCategories),
            
            // Links (Standardized)
            link: submission.link || '',
            
            // Media Fields (Standardized)
            cloudinaryPublicId: uploadedImage ? uploadedImage.publicId : null,
            promoImage: uploadedImage ? uploadedImage.url : null,
            
            // Metadata (Standardized)
            submittedBy: submission.email || submission['contact-email'] || 'anonymous@brumoutloud.co.uk',
            submitterEmail: submission['contact-email'] || submission.email || '',
            createdAt: new Date(),
            submittedAt: new Date(),
            approvedBy: null,
            approvedAt: null,
            
            // Additional Fields
            startTime: submission['start-time'] || aiTime || '00:00',
            endTime: submission['end-time'] || '23:59',
            price: submission.price || aiPrice || '',
            ageRestriction: submission['age-restriction'] || aiAgeRestriction || '',
            featured: submission.featured === 'true',
            
            // AI Extraction Metadata
            aiExtracted: aiExtractedData ? {
                confidence: aiExtractedData.confidence,
                extractedAt: new Date(),
                model: 'gemini-1.5-flash'
            } : null,
            
            // Recurring Event Fields
            isRecurring: submission['is-recurring'] === 'true',
            recurringPattern: submission['recurring-pattern'] || null,
            recurringStartDate: submission['recurring-start-date'] || null,
            recurringEndDate: submission['recurring-end-date'] || null,
            maxInstances: submission['max-instances'] ? parseInt(submission['max-instances']) : null,
            customRecurrenceDesc: submission['custom-recurrence-desc'] || null
        };
        
        // Declare ssgRebuildResult before it's potentially referenced in the recurring block
        let ssgRebuildResult = null;
        
        // Handle recurring events
        if (firestoreData.isRecurring && firestoreData.recurringPattern) {
            try {
                console.log('Processing recurring event with data:', {
                    isRecurring: firestoreData.isRecurring,
                    recurringPattern: firestoreData.recurringPattern,
                    recurringStartDate: firestoreData.recurringStartDate,
                    recurringEndDate: firestoreData.recurringEndDate,
                    maxInstances: firestoreData.maxInstances
                });
                
                const recurringManager = new RecurringEventsManager();
                
                // Map form fields to RecurringEventsManager expected format
                const recurringData = {
                    name: firestoreData.name,
                    description: firestoreData.description,
                    category: firestoreData.category,
                    venueSlug: firestoreData.venueSlug,
                    venueName: firestoreData.venueName,
                    recurringPattern: firestoreData.recurringPattern,
                    startDate: firestoreData.recurringStartDate,
                    endDate: firestoreData.recurringEndDate,
                    maxInstances: firestoreData.maxInstances || 52,
                    time: firestoreData.startTime || '20:00',
                    image: firestoreData.promoImage,
                    link: firestoreData.link,
                    price: firestoreData.price,
                    ageRestriction: firestoreData.ageRestriction
                };
                
                console.log('Mapped recurring data:', recurringData);
                
                const recurringResult = await recurringManager.createRecurringSeries(recurringData);
                
                console.log('Recurring event series created successfully:', recurringResult);
                
                // Return success response for recurring events
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: true,
                        message: `Created ${recurringResult.totalInstances} recurring event instances`,
                        recurringGroupId: recurringResult.recurringGroupId,
                        totalInstances: recurringResult.totalInstances,
                        instances: recurringResult.instances,
                        ssg: ssgRebuildResult || null,
                        aiExtraction: aiExtractedData ? {
                            success: true,
                            confidence: aiExtractedData.confidence,
                            extractedFields: Object.keys(aiExtractedData).filter(key => key !== 'confidence')
                        } : null
                    })
                };
                
            } catch (error) {
                console.error('Failed to create recurring series:', error);
                // Continue with single event creation
            }
        }
        
        // ----- Upsert resolution ----------------------------------------
        // Two ways an event can be an UPDATE rather than an INSERT:
        //   1. A valid signed resubmit token — the HMAC payload carries
        //      the doc id. We NEVER trust a raw doc id from the client:
        //      anyone could read an event's Firestore id off the public
        //      get-events response and clobber it.
        //   2. Match-key collision — same name + eventDate + venueId
        //      as an existing non-rejected doc. Anonymous submissions
        //      hitting this branch get a 409 so third parties can't
        //      stomp someone else's listing.
        const normalizedName = String(firestoreData.name || '').trim().toLowerCase();
        const resubmitToken = (submission['resubmit-token'] || '').trim() || null;
        const hasRealEmail = firestoreData.submittedBy
          && firestoreData.submittedBy !== 'anonymous@brumoutloud.co.uk';

        let targetDocRef = null;
        let matchReason = null;

        if (resubmitToken) {
            let verifyResult;
            try {
                verifyResult = verifyResubmitToken(resubmitToken);
            } catch (err) {
                // Misconfig (missing secret) — log but don't block the
                // submission; fall through to match-key / insert paths.
                console.error('Resubmit token misconfig; ignoring token:', err.message);
                verifyResult = { ok: false, reason: 'misconfig' };
            }
            if (verifyResult.ok) {
                const existing = await db.collection('events').doc(verifyResult.docId).get();
                if (existing.exists) {
                    targetDocRef = existing.ref;
                    matchReason = 'resubmit-token';
                } else {
                    console.warn('Resubmit token refers to missing doc:', verifyResult.docId);
                }
            } else {
                console.warn('Resubmit token rejected:', verifyResult.reason);
            }
        }

        if (!targetDocRef && normalizedName && firestoreData.eventDate && firestoreData.venueId) {
            const collisionQ = await db.collection('events')
                .where('eventDate', '==', firestoreData.eventDate)
                .where('venueId',   '==', firestoreData.venueId)
                .get();
            const collisions = collisionQ.docs.filter(d => {
                const dn = String((d.data() || {}).name || '').trim().toLowerCase();
                const st = String((d.data() || {}).status || '').toLowerCase();
                // Ignore rejected dupes — a rejected listing shouldn't
                // block a fresh submission at the same slot.
                return dn === normalizedName && st !== 'rejected';
            });

            if (collisions.length > 0) {
                // Ownership gate: anonymous submitter trying to alter
                // someone else's event → refuse rather than silently
                // stomping. Signed-link resubmits bypass this branch
                // above by setting targetDocRef directly.
                if (!hasRealEmail) {
                    return {
                        statusCode: 409,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            success: false,
                            code: 'duplicate',
                            message: "Looks like this event is already listed. Reply to our rejection email or email hello@brumoutloud.co.uk and we'll edit it for you.",
                        }),
                    };
                }
                // With a real email, match the first collision. Multiple
                // collisions would mean we already have duplicate events
                // in the DB, which this upsert won't make worse.
                targetDocRef = collisions[0].ref;
                matchReason = 'match-key';
            }
        }

        // ----- Insert / Update -----------------------------------------
        let firestoreDoc;
        let isUpsert = false;
        if (targetDocRef) {
            const existing = (await targetDocRef.get()).data() || {};
            // Preserve the original createdAt; everything else gets
            // overwritten. Always flip status back to pending so an
            // update forces a fresh editorial review.
            const updateData = {
                ...firestoreData,
                createdAt: existing.createdAt || firestoreData.createdAt,
                status: 'pending',
                updatedAt: new Date(),
                lastResubmittedAt: new Date(),
                lastResubmitReason: matchReason,
                // Clear any previous approval trail — this is a new
                // pending review.
                approvedBy: null,
                approvedAt: null,
                // Retain the original rejection reason only long enough
                // to display it once on the prefilled form; clear on
                // resubmit so it doesn't stick.
                rejectionReason: null,
            };
            await targetDocRef.set(updateData, { merge: true });
            firestoreDoc = { id: targetDocRef.id };
            isUpsert = true;
            console.log(`Upserted event ${targetDocRef.id} (via ${matchReason})`);
        } else {
            firestoreDoc = await db.collection('events').add(firestoreData);
            console.log('Event saved to Firestore with ID:', firestoreDoc.id);
        }
        
        // Determine promoter email (needed by both email and push notification blocks)
        const promoterEmail = firestoreData.submittedBy || firestoreData.submitterEmail;
        
        // Send email notifications. Admin alert fires unconditionally
        // (Cal wants an inbox ping for every submission, including
        // anonymous ones). Promoter confirmation only fires when we
        // actually have a real submitter address.
        try {
            const emailService = new EmailService();
            const hasPromoterEmail = promoterEmail && promoterEmail !== 'anonymous@brumoutloud.co.uk';

            if (hasPromoterEmail) {
                await emailService.sendSubmissionConfirmation(
                    promoterEmail,
                    firestoreData.name,
                    firestoreDoc.id
                );
                console.log('✅ Submission confirmation email sent to:', promoterEmail);
            } else {
                console.log('ℹ️ No valid promoter email; skipping confirmation.');
            }

            await emailService.sendAdminSubmissionAlert(
                firestoreData.name,
                hasPromoterEmail ? promoterEmail : null,
                firestoreDoc.id
            );
            console.log('✅ Admin notification email sent');
        } catch (emailError) {
            console.error('❌ Email notification failed:', emailError);
            // Don't fail the entire submission if email fails
        }

        // Send push notification to admin devices
        try {
            const pushResponse = await fetch(`${process.env.URL || 'https://brumoutloud.co.uk'}/.netlify/functions/send-push-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'new-submission',
                    title: '🎉 New Event Submission',
                    body: `"${firestoreData.name}" submitted by ${promoterEmail || 'Anonymous'}`,
                    data: {
                        eventName: firestoreData.name,
                        promoterEmail: promoterEmail || 'Anonymous',
                        eventId: firestoreDoc.id,
                        url: '/admin-approvals.html'
                    }
                })
            });

            if (pushResponse.ok) {
                console.log('✅ Push notification sent to admin devices');
            } else {
                console.log('⚠️ Push notification failed:', await pushResponse.text());
            }
        } catch (pushError) {
            console.error('❌ Push notification failed:', pushError);
            // Don't fail the entire submission if push notification fails
        }
        
        // Trigger SSG rebuild if in production
        if (process.env.NODE_ENV === 'production' && process.env.NETLIFY_BUILD_HOOK) {
            try {
                const response = await fetch(process.env.NETLIFY_BUILD_HOOK, { method: 'POST' });
                if (response.ok) {
                    ssgRebuildResult = { success: true, message: 'Build hook triggered successfully.' };
                } else {
                    ssgRebuildResult = { success: false, message: `Failed to trigger build hook: ${response.status} ${response.statusText}` };
                }
            } catch (error) {
                ssgRebuildResult = { success: false, message: error.message };
            }
        }
        
        // Return success response as JSON for client script
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                id: firestoreDoc.id,
                slug,
                ssg: ssgRebuildResult || null,
                aiExtraction: aiExtractedData ? {
                    success: true,
                    confidence: aiExtractedData.confidence,
                    extractedFields: Object.keys(aiExtractedData).filter(key => 
                        aiExtractedData[key] && key !== 'confidence'
                    )
                } : null
            })
        };
        
    } catch (error) {
        console.error('Error in Firestore-only event submission:', error);

        // Create a GitHub Issue for Jules review
        const githubToken = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
        if (githubToken) {
            const owner = process.env.GITHUB_REPO_OWNER || 'calsaundrs';
            const repo = process.env.GITHUB_REPO_NAME || 'website';

            console.log(`Attempting to create GitHub issue for Jules review on ${owner}/${repo}...`);
            try {
                const issueBody = `The production form is failing with an error.

**Source:** event-submission.js
**Error Type:** ${error.constructor.name || 'Error'}
**Error Message:** ${error.message || 'Unknown error'}

**Stack Trace:**
\`\`\`
${error.stack ? error.stack.substring(0, 1500) : 'No stack trace available'}
\`\`\`

*Label this issue with \`jules-fix\` to trigger an automatic AI review and fix.*`;

                const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${githubToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'Netlify-Function'
                    },
                    body: JSON.stringify({
                        title: `[Production Error] Event Submission Failure: ${error.message || 'Unknown'}`,
                        body: issueBody,
                        labels: ['bug']
                    })
                });

                if (!res.ok) {
                    const errText = await res.text();
                    console.error('Failed to create GitHub issue:', res.status, errText);
                } else {
                    console.log('✅ Successfully created GitHub issue for Jules review');
                }
            } catch (dispatchError) {
                console.error('Error creating GitHub issue:', dispatchError);
            }
        } else {
            console.log('⚠️ GITHUB_PAT or GITHUB_TOKEN not configured. Skipping GitHub issue creation.');
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Event submission failed',
                message: error.message,
                type: error.constructor.name
            })
        };
    }
};

function generateSlug(eventName, date) {
    const safeName = String(eventName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const d = new Date(date);
    const datePart = isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
    return `${safeName}-${datePart}`;
}

function generateVenueSlug(venueName) {
    return venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getCategories(submission, aiCategories) {
    function parseCSV(value) {
        return String(value).split(',').map(c => c.trim()).filter(Boolean);
    }

    if (submission.categories) {
        return Array.isArray(submission.categories) ? submission.categories : parseCSV(submission.categories);
    }
    if (submission.category) {
        return parseCSV(submission.category);
    }
    if (submission.categoryIds) {
        return Array.isArray(submission.categoryIds) ? submission.categoryIds : parseCSV(submission.categoryIds);
    }
    if (aiCategories && Array.isArray(aiCategories)) {
        return aiCategories;
    }
    if (submission['category-select']) {
        return [submission['category-select']];
    }
    return [];
}