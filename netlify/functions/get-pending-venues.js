const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

async function fetchAllPendingVenues() {
    console.log('[Venues] Starting paginated fetch for records with status "Pending Review".');
    const allRecords = [];
    let pageCount = 0;
    try {
        await base('Venues').select({
            filterByFormula: "{Status} = 'Pending Review'",
            fields: ['Name', 'Description', 'Address', 'Contact Email', 'Website', 'Status', 'Created Time']
        }).eachPage((records, fetchNextPage) => {
            pageCount++;
            console.log(`[Venues] Fetched page ${pageCount} with ${records.length} records.`);
            records.forEach(record => allRecords.push(record));
            fetchNextPage();
        });
        console.log(`[Venues] Finished paginated fetch. Total pages: ${pageCount}. Total records found: ${allRecords.length}`);
        return allRecords;
    } catch (error) {
        console.error(`[Venues] Error during Airtable 'eachPage' call:`, error);
        throw error;
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const venueRecords = await fetchAllPendingVenues();
        
        const formattedVenues = venueRecords.map(record => ({
            id: record.id,
            fields: {
                ...record.fields,
                Type: 'Venue'
            }
        }));

        return {
            statusCode: 200,
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formattedVenues),
        };
    } catch (error) {
        console.error("Critical error in get-pending-venues handler:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch pending venues', details: error.toString() }),
        };
    }
};
