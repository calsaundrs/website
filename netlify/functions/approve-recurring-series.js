const Airtable = require('airtable');

const AIRTABLE_PERSONAL_ACCESS_TOKEN = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    console.log('approve-recurring-series: Starting function execution');

    if (!AIRTABLE_PERSONAL_ACCESS_TOKEN || !AIRTABLE_BASE_ID) {
        console.error('approve-recurring-series: Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing Airtable configuration' }),
        };
    }

    const base = new Airtable({ apiKey: AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

    try {
        console.log('approve-recurring-series: Request body:', event.body);
        const { eventId, approveFutureInstances = true } = JSON.parse(event.body);

        if (!eventId) {
            console.error('approve-recurring-series: No event ID provided');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Event ID is required' }),
            };
        }
        
        console.log('approve-recurring-series: Processing event ID:', eventId, 'approveFutureInstances:', approveFutureInstances);

        console.log(`approve-recurring-series: Approving event ${eventId} with future instances: ${approveFutureInstances}`);

        // Get the event details
        const eventRecord = await base('Events').find(eventId);
        const eventFields = eventRecord.fields;

        console.log(`approve-recurring-series: Event details: ${eventFields['Event Name']} (Series ID: ${eventFields['Series ID']})`);

        // If it's not a recurring event, just approve it normally
        if (!eventFields['Series ID']) {
            console.log('approve-recurring-series: Not a recurring event, approving normally');
            
            await base('Events').update([
                {
                    id: eventId,
                    fields: {
                        'Status': 'Approved'
                    }
                }
            ]);

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Event approved successfully',
                    approvedCount: 1
                }),
            };
        }

        // If approveFutureInstances is false, just approve this one instance
        if (!approveFutureInstances) {
            console.log('approve-recurring-series: Approving only this instance');
            
            await base('Events').update([
                {
                    id: eventId,
                    fields: {
                        'Status': 'Approved'
                    }
                }
            ]);

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Event instance approved successfully',
                    approvedCount: 1
                }),
            };
        }

        // Get all instances of this series
        const seriesId = eventFields['Series ID'];
        const allInstances = await base('Events').select({
            filterByFormula: `{Series ID} = '${seriesId}'`,
            fields: ['Event Name', 'Date', 'Status']
        }).all();

        console.log(`approve-recurring-series: Found ${allInstances.length} instances in series`);

        // Get the number of instances to approve from settings
        const instancesToApprove = parseInt(process.env.RECURRING_INSTANCES_TO_APPROVE) || 3;
        console.log(`approve-recurring-series: Will approve up to ${instancesToApprove} future instances`);

        // Filter to only pending future instances and limit to the configured number
        const now = new Date();
        const pendingFutureInstances = allInstances.filter(instance => {
            const eventDate = new Date(instance.fields.Date);
            const status = instance.fields.Status;
            return eventDate > now && status === 'Pending Review';
        }).slice(0, instancesToApprove);

        console.log(`approve-recurring-series: Found ${pendingFutureInstances.length} pending future instances to approve`);

        // Approve all pending future instances
        if (pendingFutureInstances.length > 0) {
            const updateRecords = pendingFutureInstances.map(instance => ({
                id: instance.id,
                fields: {
                    'Status': 'Approved'
                }
            }));

            await base('Events').update(updateRecords);

            console.log(`approve-recurring-series: Approved ${pendingFutureInstances.length} future instances`);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                success: true, 
                message: `Approved ${pendingFutureInstances.length} future instances of the series`,
                approvedCount: pendingFutureInstances.length,
                seriesName: eventFields['Event Name']
            }),
        };

    } catch (error) {
        console.error("approve-recurring-series: Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to approve recurring series', 
                details: error.toString(),
                message: error.message 
            }),
        };
    }
};