const Airtable = require('airtable');
const SlugGenerator = require('./utils/slug-generator');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

const slugGenerator = new SlugGenerator();

// Configuration
const BATCH_SIZE = 10; // Process 10 events at a time
const MAX_EXECUTION_TIME = 8000; // 8 seconds to leave buffer

exports.handler = async (event, context) => {
  try {
    const startTime = Date.now();
    console.log('Starting chunked event data migration...');
    
    // Parse request parameters
    const { offset = 0, batchSize = BATCH_SIZE, dryRun = false } = event.queryStringParameters || {};
    const parsedOffset = parseInt(offset);
    const parsedBatchSize = parseInt(batchSize);
    const isDryRun = dryRun === 'true';
    
    console.log(`Processing batch: offset=${parsedOffset}, batchSize=${parsedBatchSize}, dryRun=${isDryRun}`);
    
    // Get events with pagination
    const query = base('Events').select({
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 
        'Parent Event Name', 'Date', 'Status', 'Venue Name', 'VenueText'
      ],
      pageSize: parsedBatchSize,
      offset: parsedOffset > 0 ? parsedOffset : undefined
    });
    
    const records = await query.all();
    console.log(`Retrieved ${records.length} events starting from offset ${parsedOffset}`);
    
    if (records.length === 0) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({ 
          message: 'Migration completed - no more records to process',
          completed: true,
          processed: 0,
          errors: 0,
          nextOffset: null
        })
      };
    }
    
    // Process the batch
    const results = await processBatch(records, isDryRun);
    
    const executionTime = Date.now() - startTime;
    const hasMoreRecords = records.length === parsedBatchSize;
    const nextOffset = hasMoreRecords ? (parsedOffset + parsedBatchSize) : null;
    
    console.log(`Batch completed in ${executionTime}ms. Processed: ${results.processed}, Errors: ${results.errors}`);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        message: `Batch processed successfully`,
        completed: !hasMoreRecords,
        processed: results.processed,
        errors: results.errors,
        nextOffset: nextOffset,
        executionTime: executionTime,
        batchSize: records.length,
        dryRun: isDryRun
      })
    };
    
  } catch (error) {
    console.error('Chunked migration failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

async function processBatch(records, isDryRun) {
  let processed = 0;
  let errors = 0;
  const updates = [];
  
  // Group records by series
  const seriesGroups = new Map();
  const standaloneEvents = [];
  
  records.forEach(record => {
    const fields = record.fields;
    
    if (fields['Series ID'] || fields['Recurring Info']) {
      const seriesId = fields['Series ID'] || record.id;
      if (!seriesGroups.has(seriesId)) {
        seriesGroups.set(seriesId, []);
      }
      seriesGroups.get(seriesId).push(record);
    } else {
      standaloneEvents.push(record);
    }
  });
  
  console.log(`Batch contains ${seriesGroups.size} series and ${standaloneEvents.length} standalone events`);
  
  // Process series events
  for (const [seriesId, events] of seriesGroups) {
    try {
      const result = await processSeries(seriesId, events, isDryRun);
      updates.push(...result);
      processed += events.length;
    } catch (error) {
      console.error(`Error processing series ${seriesId}:`, error);
      errors += events.length;
    }
  }
  
  // Process standalone events
  for (const event of standaloneEvents) {
    try {
      const result = await processStandaloneEvent(event, isDryRun);
      if (result) updates.push(result);
      processed++;
    } catch (error) {
      console.error(`Error processing standalone event ${event.id}:`, error);
      errors++;
    }
  }
  
  // Apply updates if not dry run
  if (!isDryRun && updates.length > 0) {
    console.log(`Applying ${updates.length} updates...`);
    await applyUpdates(updates);
  }
  
  return { processed, errors };
}

async function processSeries(seriesId, events, isDryRun) {
  console.log(`Processing series ${seriesId} with ${events.length} events`);
  
  // Find parent event (has Recurring Info)
  const parentEvent = events.find(e => e.fields['Recurring Info']);
  if (!parentEvent) {
    console.warn(`No parent event found for series ${seriesId}`);
    return [];
  }
  
  // Generate series slug
  const existingSlugs = await getExistingSlugs();
  const seriesSlug = await slugGenerator.ensureUniqueSlug(
    slugGenerator.generateSlug(parentEvent.fields['Event Name']),
    existingSlugs
  );
  
  const updates = [];
  
  // Update parent event
  updates.push({
    id: parentEvent.id,
    fields: {
      'Slug': seriesSlug,
      'Series ID': seriesId
    }
  });
  
  // Update child events
  for (const childEvent of events) {
    if (childEvent.id !== parentEvent.id) {
      updates.push({
        id: childEvent.id,
        fields: {
          'Slug': seriesSlug,
          'Series ID': seriesId
        }
      });
    }
  }
  
  return updates;
}

async function processStandaloneEvent(event, isDryRun) {
  const fields = event.fields;
  const eventName = fields['Event Name'];
  
  if (!eventName) {
    console.warn(`Event ${event.id} has no name, skipping`);
    return null;
  }
  
  // Generate unique slug
  const existingSlugs = await getExistingSlugs();
  const slug = await slugGenerator.ensureUniqueSlug(
    slugGenerator.generateSlug(eventName, { includeDate: true, date: fields['Date'] }),
    existingSlugs
  );
  
  return {
    id: event.id,
    fields: {
      'Slug': slug,
      'Series ID': null // Ensure standalone events have no series ID
    }
  };
}

async function applyUpdates(updates) {
  // Group updates by record ID to avoid duplicates
  const updateMap = new Map();
  updates.forEach(update => {
    if (updateMap.has(update.id)) {
      // Merge fields
      updateMap.set(update.id, {
        ...updateMap.get(update.id),
        fields: { ...updateMap.get(update.id).fields, ...update.fields }
      });
    } else {
      updateMap.set(update.id, update);
    }
  });
  
  const uniqueUpdates = Array.from(updateMap.values());
  
  // Apply updates in batches of 10
  const updateBatches = [];
  for (let i = 0; i < uniqueUpdates.length; i += 10) {
    updateBatches.push(uniqueUpdates.slice(i, i + 10));
  }
  
  for (const batch of updateBatches) {
    const updatePromises = batch.map(update => 
      base('Events').update(update.id, update.fields)
    );
    await Promise.all(updatePromises);
  }
  
  console.log(`Applied ${uniqueUpdates.length} updates`);
}

async function getExistingSlugs() {
  try {
    const records = await base('Events').select({
      fields: ['Slug'],
      filterByFormula: "NOT({Slug} = '')"
    }).all();
    
    return records.map(record => record.fields['Slug']).filter(Boolean);
  } catch (error) {
    console.error('Error fetching existing slugs:', error);
    return [];
  }
}