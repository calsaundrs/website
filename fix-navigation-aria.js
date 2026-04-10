const fs = require('fs');
const path = require('path');

const directoryPath = __dirname;
const SCRIPT_REGEX = /<script>\s*const menuBtn = document\.getElementById\('menu-btn'\);\s*const menu = document\.getElementById\('menu'\);\s*if \(menuBtn && menu\) \{\s*menuBtn\.addEventListener\('click', \(\) => \{\s*menu\.classList\.toggle\('hidden'\);\s*menu\.classList\.toggle\('flex'\);\s*\}\);\s*\}\s*<\/script>/g;

const REPLACEMENT_SCRIPT = `<script>
        const menuBtn = document.getElementById('menu-btn');
        const menu = document.getElementById('menu');
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', () => {
                const isExpanded = menuBtn.getAttribute('aria-expanded') === 'true' || false;
                menuBtn.setAttribute('aria-expanded', !isExpanded);
                menu.classList.toggle('hidden');
                menu.classList.toggle('flex');
                
                if (!isExpanded) {
                    document.body.style.overflow = 'hidden';
                } else {
                    document.body.style.overflow = '';
                }
            });
        }
    </script>`;

function processDirectory(directory) {
    fs.readdir(directory, { withFileTypes: true }, (err, files) => {
        if (err) return console.log(err);
        
        files.forEach((file) => {
            const filePath = path.join(directory, file.name);
            if (file.isDirectory() && !file.name.match(/^(node_modules|\.git|\.github|css|images|js|remotion-templates|tests|netlify|global)$/)) {
                processDirectory(filePath);
            } else if (file.isFile() && file.name.endsWith('.html')) {
                let data = fs.readFileSync(filePath, 'utf8');
                let changed = false;

                // Fix script
                if (SCRIPT_REGEX.test(data)) {
                    data = data.replace(SCRIPT_REGEX, REPLACEMENT_SCRIPT);
                    changed = true;
                }

                // Add ARIA to menu-btn if missing
                const btnRegex = /<button id="menu-btn" class="([^"]*)">/g;
                if (btnRegex.test(data)) {
                    data = data.replace(btnRegex, `<button id="menu-btn" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="menu" class="$1 p-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toxic">`);
                    changed = true;
                }

                if (changed) {
                    fs.writeFileSync(filePath, data, 'utf8');
                    console.log(`Fixed ARIA in ${filePath}`);
                }
            }
        });
    });
}

processDirectory(directoryPath);
