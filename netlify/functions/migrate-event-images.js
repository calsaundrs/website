const Airtable = require('airtable');
const cloudinary = require('cloudinary').v2;
const fetch = require('node-fetch');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Fetch events that have a Promo Image but are not yet Cloudinary Processed
        const records = await base('Events').select({
            filterByFormula: 'AND({Promo Image} != "", {Cloudinary Processed} = FALSE())',
            fields: ['Event Name', 'Promo Image', 'Cloudinary Public ID', 'Cloudinary Processed']
        }).firstPage();

        if (records.length === 0) {
            return { statusCode: 200, body: 'No new events to migrate to Cloudinary.' };
        }

        const migrationPromises = records.map(async (record) => {
            const eventId = record.id;
            const eventName = record.get('Event Name');
            const promoImage = record.get('Promo Image');

            if (!promoImage || promoImage.length === 0) {
                console.log(`Event ${eventName} (ID: ${eventId}) has no promo image. Skipping.`);
                return;
            }

            const imageUrl = promoImage[0].url;
            console.log(`Processing image for event: ${eventName} from URL: ${imageUrl}`);

            try {
                // Upload image to Cloudinary
                const uploadResult = await cloudinary.uploader.upload(imageUrl, {
                    folder: 'brumoutloud_events', // Optional: organize your uploads in a specific folder
                    public_id: `event_${eventId}`, // Use event ID for a unique public ID
                    overwrite: true // Overwrite if public ID already exists
                });

                console.log(`Uploaded ${eventName} to Cloudinary. Public ID: ${uploadResult.public_id}`);

                // Update Airtable record
                await base('Events').update([
                    {
                        id: eventId,
                        fields: {
                            'Cloudinary Public ID': uploadResult.public_id,
                            'Cloudinary Processed': true
                        }
                    }
                ]);
                console.log(`Airtable updated for event: ${eventName}`);
                return { eventId, status: 'success', public_id: uploadResult.public_id };

            } catch (uploadError) {
                console.error(`Error uploading image for event ${eventName} (ID: ${eventId}):`, uploadError);
                return { eventId, status: 'error', message: uploadError.message };
            }
        });

        const results = await Promise.all(migrationPromises);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Migration process completed. Processed ${results.length} events.`,
                results: results
            })
        };

    } catch (error) {
        console.error('Error in migration function:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error', details: error.message }) };
    }
};
