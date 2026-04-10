const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname);

function sweepDirectory(dir) {
    fs.readdir(dir, (err, files) => {
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }
        
        files.forEach((file) => {
            const filePath = path.join(dir, file);
            
            // Skip node_modules and .git
            if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('.next')) {
                return;
            }

            fs.stat(filePath, (err, stats) => {
                if (stats.isDirectory()) {
                    sweepDirectory(filePath);
                } else if (path.extname(filePath) === '.html') {
                    cleanHtmlFile(filePath);
                }
            });
        });
    });
}

function cleanHtmlFile(filePath) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return console.log(err);
        }

        let originalData = data;

        // Strip known messy inline blocks
        const regexes = [
            /\.progress-pride-bg\s*\{[^}]*\}/g,
            /\.neo-card\s*\{[^}]*\}/g,
            /\.neo-card:hover\s*\{[^}]*\}/g,
            /\.venue-card\s*\{[^}]*\}/g,
            /\.venue-card:hover\s*\{[^}]*\}/g,
            /\.venue-card:focus-visible\s*\{[^}]*\}/g,
            /\.brutalist-card\s*\{[^}]*\}/g,
            /\.brutalist-card:hover\s*\{[^}]*\}/g,
            /\.event-card\s*\{[^}]*\}/g,
            /\.event-card:hover\s*\{[^}]*\}/g,
            /\.sticker\s*\{[^}]*\}/g,
            /\.sticker:hover\s*\{[^}]*\}/g,
            /h1,\s*h2,\s*h3,\s*\.font-display\s*\{[^}]*\}/g
        ];

        let result = data;
        regexes.forEach(regex => {
            result = result.replace(regex, '');
        });

        // Optional: Remove entirely empty style tags
        result = result.replace(/<style>\s*<\/style>/g, '');

        if (originalData !== result) {
            fs.writeFile(filePath, result, 'utf8', (err) => {
                if (err) return console.log(err);
                console.log(`Cleaned inline styles in: ${filePath}`);
            });
        }
    });
}

console.log('Initiating CSS Inline Styles Sweep...');
sweepDirectory(directoryPath);
