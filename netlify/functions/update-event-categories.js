const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

// This function is designed to be run once to migrate old categories to the new, inclusive ones.
// It will:
// 1. Replace "Fetish" with "Kink"
// 2. Replace "Women Only" with "Queer Women & Sapphic"
// 3. Remove "Men Only"
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        let updatedCount = 0;
        const records = await base('Events').select().all();

        const updates = [];

        records.forEach(record => {
            const currentCategories = record.get('Category') || [];
            if (currentCategories.length === 0) {
                return; // Skip records with no categories
            }

            let needsUpdate = false;
            const newCategories = new Set(currentCategories);

            // Rule 1: Replace "Fetish" with "Kink"
            if (newCategories.has('Fetish')) {
                newCategories.delete('Fetish');
                newCategories.add('Kink');
                needsUpdate = true;
            }

            // Rule 2: Replace "Women Only" with "Queer Women & Sapphic"
            if (newCategories.has('Women Only')) {
                newCategories.delete('Women Only');
                newCategories.add('Queer Women & Sapphic');
                needsUpdate = true;
            }

            // Rule 3: Remove "Men Only"
            if (newCategories.has('Men Only')) {
                newCategories.delete('Men Only');
                needsUpdate = true;
            }

            if (needsUpdate) {
                updates.push({
                    id: record.id,
                    fields: {
                        'Category': Array.from(newCategories)
                    }
                });
                updatedCount++;
            }
        });

        // Airtable API allows updating 10 records at a time
        for (let i = 0; i < updates.length; i += 10) {
            const chunk = updates.slice(i, i + 10);
            await base('Events').update(chunk);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Migration complete. ${updatedCount} events were updated.` })
        };

    } catch (error) {
        console.error('Error during category migration:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'An error occurred during the migration.', error: error.message })
        };
    }
};
