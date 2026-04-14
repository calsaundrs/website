const fs = require('fs');
const path = require('path');

const functionFile = path.join(__dirname, 'netlify', 'functions', 'get-event-details.js');
const templateFile = path.join(__dirname, 'event-template.html');

let functionContent = fs.readFileSync(functionFile, 'utf8');
const templateContent = fs.readFileSync(templateFile, 'utf8');

// Find the template string boundary
const startMarker = 'const templateContent = `';
const endMarker = '`;\n\n        // Register Handlebars helpers';

const startIndex = functionContent.indexOf(startMarker);
const endIndex = functionContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find template boundaries in get-event-details.js!");
    process.exit(1);
}

// Replace the content
const newContent = functionContent.substring(0, startIndex + startMarker.length) 
                   + templateContent 
                   + functionContent.substring(endIndex);

fs.writeFileSync(functionFile, newContent);
console.log("Successfully synced event-template.html into get-event-details.js!");
