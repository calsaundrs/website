const fs = require('fs');
const path = require('path');

const directoryPath = __dirname;
const CDN_TAG = '<script src="https://cdn.tailwindcss.com"></script>';
const TAILWIND_CSS_LINK = '<link rel="stylesheet" href="/css/tailwind.css">';

function processDirectory(directory) {
    fs.readdir(directory, { withFileTypes: true }, (err, files) => {
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        }

        files.forEach((file) => {
            const filePath = path.join(directory, file.name);

            // Skip node_modules and .git
            if (file.isDirectory() && !file.name.match(/^(node_modules|\.git|\.github|css|images|js|remotion-templates|tests|netlify|global)$/)) {
                processDirectory(filePath);
            } else if (file.isFile() && file.name.endsWith('.html')) {
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        return console.log(err);
                    }

                    if (data.includes(CDN_TAG)) {
                        let replaced = data.replace(CDN_TAG, TAILWIND_CSS_LINK);
                        
                        fs.writeFile(filePath, replaced, 'utf8', (err) => {
                            if (err) return console.log(err);
                            console.log(`Updated ${filePath}`);
                        });
                    }
                });
            }
        });
    });
}

// Process root HTMLs and the venue directory, etc
processDirectory(directoryPath);
// Also explicitly do the venue folder
processDirectory(path.join(directoryPath, 'venue'));
