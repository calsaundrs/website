const Airtable = require('airtable');

exports.handler = async (event, context) => {
  try {
    console.log('Starting simple migration test...');
    
    // Check environment variables
    if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
      throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN not found');
    }
    
    if (!process.env.AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID not found');
    }
    
    console.log('Environment variables OK');
    
    // Initialize Airtable
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
    }).base(process.env.AIRTABLE_BASE_ID);
    
    console.log('Airtable initialized');
    
    // Parse request parameters
    const { offset = 0, batchSize = 5, dryRun = false } = event.queryStringParameters || {};
    const parsedOffset = parseInt(offset);
    const parsedBatchSize = parseInt(batchSize);
    const isDryRun = dryRun === 'true';
    
    console.log(`Parameters: offset=${parsedOffset}, batchSize=${parsedBatchSize}, dryRun=${isDryRun}`);
    
    // Simple query with proper pagination
    const query = base('Events').select({
      fields: ['Event Name', 'Slug', 'Recurring Info', 'Series ID'],
      pageSize: parsedBatchSize
    });
    
    console.log('Query created, fetching records...');
    
    const records = await query.all();
    console.log(`Retrieved ${records.length} events`);
    
    // Check if we have more records
    const hasMoreRecords = records.length === parsedBatchSize && records.offset;
    const nextOffset = hasMoreRecords ? records.offset : null;
    
    // Simple processing - just count and return info
    let processed = 0;
    let errors = 0;
    const eventInfo = [];
    
    records.forEach((record, index) => {
      try {
        const fields = record.fields;
        eventInfo.push({
          id: record.id,
          name: fields['Event Name'] || 'No name',
          hasSlug: !!fields['Slug'],
          hasRecurringInfo: !!fields['Recurring Info'],
          hasSeriesId: !!fields['Series ID']
        });
        processed++;
      } catch (error) {
        console.error(`Error processing record ${index}:`, error);
        errors++;
      }
    });
    
    console.log(`Processing complete: ${processed} processed, ${errors} errors`);
    console.log(`Has more records: ${hasMoreRecords}, Next offset: ${nextOffset}`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        message: 'Simple migration test completed',
        completed: !hasMoreRecords,
        processed: processed,
        errors: errors,
        nextOffset: nextOffset,
        executionTime: Date.now(),
        batchSize: records.length,
        dryRun: isDryRun,
        sampleEvents: eventInfo.slice(0, 3), // Show first 3 events for debugging
        debug: {
          hasMoreRecords,
          offset: records.offset,
          totalRecords: records.length
        }
      })
    };
    
  } catch (error) {
    console.error('Simple migration failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })
    };
  }
};