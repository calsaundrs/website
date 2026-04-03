const fs = require('fs').promises;
const path = require('path');

async function fixPridePage() {
    const filePath = path.join(__dirname, 'birmingham-pride.html');
    let content = await fs.readFile(filePath, 'utf8');

    const d = new Date();
    let year = d.getFullYear();
    // Optional: If pride has already passed in the current year, flip to next year.
    if (d.getMonth() > 4) { // June onwards
        year += 1;
    }

    // Statically replace the dynamic template tags with the actual year text for SEO
    content = content.replace(/\{\{CURRENT_YEAR\}\}/g, year);
    content = content.replace(/\{\{PRIDE_DATES\}\}/g, `23-24 May ${year}`);

    // Remove the span tags from the schema too
    content = content.replace(/2026(?=<\/span>)/g, year);

    // If there is an existing script tag at the bottom doing client-side replacement, we can leave it or remove it.
    // Since we are statically building it correctly now, it's safer. Let's just write the changes.
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Fixed pride page for year ${year}.`);
}

fixPridePage().catch(console.error);
