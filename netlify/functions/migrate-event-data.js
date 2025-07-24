const Airtable = require('airtable');
const SlugGenerator = require('./utils/slug-generator');

const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID);

const slugGenerator = new SlugGenerator();

exports.handler = async (event, context) => {
  try {
    console.log('Starting event data migration...');
    
    // Get all events
    const allRecords = await base('Events').select({
      fields: [
        'Event Name', 'Slug', 'Recurring Info', 'Series ID', 
        'Parent Event Name', 'Date', 'Status', 'Venue Name', 'VenueText'
      ]
    }).all();

    console.log(`Found ${allRecords.length} events to process`);

    // Group events by series
    const seriesGroups = new Map();
    const standaloneEvents = [];

    allRecords.forEach(record => {
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

    console.log(`Found ${seriesGroups.size} series and ${standaloneEvents.length} standalone events`);

    // Process series events
    for (const [seriesId, events] of seriesGroups) {
      await processSeries(seriesId, events);
    }

    // Process standalone events
    for (const event of standaloneEvents) {
      await processStandaloneEvent(event);
    }

    console.log('Migration completed successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Migration completed',
        seriesProcessed: seriesGroups.size,
        standaloneProcessed: standaloneEvents.length
      })
    };

  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function processSeries(seriesId, events) {
  console.log(`Processing series ${seriesId} with ${events.length} events`);
  
  // Find parent event (has Recurring Info)
  const parentEvent = events.find(e => e.fields['Recurring Info']);
  if (!parentEvent) {
    console.warn(`No parent event found for series ${seriesId}`);
    return;
  }

  // Generate series slug
  const seriesSlug = await slugGenerator.ensureUniqueSlug(
    slugGenerator.generateSlug(parentEvent.fields['Event Name']),
    await getExistingSlugs()
  );

  // Update parent event
  await updateEvent(parentEvent.id, {
    'Slug': seriesSlug,
    'Series ID': seriesId
  });

  // Update child events
  for (const childEvent of events) {
    if (childEvent.id !== parentEvent.id) {
      await updateEvent(childEvent.id, {
        'Slug': seriesSlug,
        'Series ID': seriesId
      });
    }
  }
}

async function processStandaloneEvent(event) {
  const fields = event.fields;
  
  // Generate date-specific slug
  const eventSlug = await slugGenerator.ensureUniqueSlug(
    slugGenerator.generateSlug(fields['Event Name'], { 
      includeDate: true, 
      date: fields['Date'] 
    }),
    await getExistingSlugs()
  );

  // Update event
  await updateEvent(event.id, {
    'Slug': eventSlug
  });
}

async function updateEvent(recordId, updates) {
  try {
    await base('Events').update(recordId, updates);
    console.log(`Updated event ${recordId}`);
  } catch (error) {
    console.error(`Failed to update event ${recordId}:`, error);
  }
}

async function getExistingSlugs() {
  const records = await base('Events').select({
    fields: ['Slug']
  }).all();
  
  return records.map(r => r.fields['Slug']).filter(Boolean);
}