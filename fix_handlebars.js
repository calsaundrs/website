const fs = require('fs');
const path = require('path');

const templateFile = path.join(__dirname, 'event-template.html');
let html = fs.readFileSync(templateFile, 'utf8');

html = html.replace(/\{\{#if event\.imageUrl\}\}/g, '{{#if event.image}}');
html = html.replace(/event\.imageUrl/g, 'event.image.url');
html = html.replace(/\{\{event\.formattedDate\}\}/g, '{{formatDateOnly event.date}}');
html = html.replace(/\{\{event\.time\}\}/g, '{{formatTime event.date}}');
html = html.replace(/event\.ticketLink/g, 'event.details.link');
html = html.replace(/event\.otherInstances/g, 'otherInstances');

fs.writeFileSync(templateFile, html);
console.log('Fixed event-template.html variables!');
