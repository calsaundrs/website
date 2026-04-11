import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const headerSource = fs.readFileSync(path.join(__dirname, 'global/header.html'), 'utf8');
const footerSource = fs.readFileSync(path.join(__dirname, 'global/footer.html'), 'utf8');

// Regex to match header and footer tags and their content
const headerRegex = /<header[\s\S]*?<\/header>/;
const footerRegex = /<footer[\s\S]*?<\/footer>/;

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory && !f.startsWith('.') && !['node_modules', 'global', 'js', 'css', 'venue', 'netlify', 'tests', '.git', '.github'].includes(f)) {
            walkDir(dirPath, callback);
        } else if (!isDirectory && f.endsWith('.html')) {
            callback(dirPath);
        }
    });
}

const targetFiles = [];
walkDir(__dirname, (filePath) => {
    targetFiles.push(filePath);
});

console.log(`Ultra-Safe Sync: Processing ${targetFiles.length} files...`);

targetFiles.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let modifiedCount = 0;

    // 1. Sync Header
    if (headerRegex.test(content)) {
        content = content.replace(headerRegex, headerSource);
        modifiedCount++;
    }

    // 2. Sync Footer
    if (footerRegex.test(content)) {
        content = content.replace(footerRegex, footerSource);
        modifiedCount++;
    }

    // 3. Ensure main.js connectivity (ADDITIVE ONLY)
    if (modifiedCount > 0 && !content.includes('js/main.js')) {
        content = content.replace('</body>', '    <script src="/js/main.js"></script>\n</body>');
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Synced] ${path.relative(__dirname, filePath)}`);
    }
});

console.log('Ultra-Safe Global Module Sync Complete.');
