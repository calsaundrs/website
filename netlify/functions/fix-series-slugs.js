const Airtable = require('airtable');
const SlugGenerator = require('./utils/slug-generator');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

const slugGenerator = new SlugGenerator();

exports.handler = async (event, context) => {
  try {
    console.log('Starting series slug fix...');
    
    // Parse request parameters
    const { dryRun = false } = event.queryStringParameters || {};
    const isDryRun = dryRun === 'true';
    
    console.log(`Dry run mode: ${isDryRun}`);
    
    // Get all events with Series ID
    const records = await base('Events').select({
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 'Date', 'Status'
      ],
      filterByFormula: "NOT({Series ID} = '')"
    }).all();
    
    console.log(`Found ${records.length} events with Series ID`);
    
    // Group events by Series ID
    const seriesGroups = new Map();
    records.forEach(record => {
      const seriesId = record.fields['Series ID'];
      if (!seriesGroups.has(seriesId)) {
        seriesGroups.set(seriesId, []);
      }
      seriesGroups.get(seriesId).push(record);
    });
    
    console.log(`Found ${seriesGroups.size} series groups`);
    
    let processed = 0;
    let errors = 0;
    const updates = [];
    
    // Process each series
    for (const [seriesId, events] of seriesGroups) {
      try {
        console.log(`Processing series ${seriesId} with ${events.length} events`);
        
        // Sort events by date
        events.sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));
        
        // Generate unique slugs for each instance
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          const eventName = event.fields['Event Name'];
          const eventDate = event.fields['Date'];
          
          // Generate slug with date and instance number
          const baseSlug = slugGenerator.generateSlug(eventName, { 
            includeDate: true, 
            date: eventDate 
          });
          
          // Add instance number to make it unique
          const uniqueSlug = `${baseSlug}-instance-${i + 1}`;
          
          console.log(`Event ${i + 1}: ${eventName} -> ${uniqueSlug}`);
          
          updates.push({
            id: event.id,
            fields: {
              'Slug': uniqueSlug
            }
          });
          
          processed++;
        }
        
      } catch (error) {
        console.error(`Error processing series ${seriesId}:`, error);
        errors += events.length;
      }
    }
    
    // Apply updates if not dry run
    if (!isDryRun && updates.length > 0) {
      console.log(`Applying ${updates.length} updates...`);
      await applyUpdates(updates);
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        message: `Series slug fix ${isDryRun ? 'test' : 'completed'} successfully`,
        processed: processed,
        errors: errors,
        updates: updates.length,
        dryRun: isDryRun
      })
    };
    
  } catch (error) {
    console.error('Series slug fix failed:', error);
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

async function applyUpdates(updates) {
  // Apply updates in batches of 10
  const updateBatches = [];
  for (let i = 0; i < updates.length; i += 10) {
    updateBatches.push(updates.slice(i, i + 10));
  }
  
  for (const batch of updateBatches) {
    const updatePromises = batch.map(update => 
      base('Events').update(update.id, update.fields)
    );
    await Promise.all(updatePromises);
  }
  
  console.log(`Applied ${updates.length} updates`);
}