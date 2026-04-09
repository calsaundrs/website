import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(__dirname, function (filePath) {
    if (filePath.endsWith('.html') && !filePath.includes('node_modules') && !filePath.includes('.git') && !filePath.includes('remotion-templates')) {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        let tags = [];

        // Check for Google APIs / Firestore
        if (content.includes('firestore') || content.includes('googleapis') || content.includes('gstatic')) {
             if (!content.match(/<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/firestore\.googleapis\.com["'][^>]*>/i)) {
                 tags.push('    <link rel="preconnect" href="https://firestore.googleapis.com">');
             }
             if (!content.match(/<link[^>]*rel=["']dns-prefetch["'][^>]*href=["']https:\/\/firestore\.googleapis\.com["'][^>]*>/i)) {
                 tags.push('    <link rel="dns-prefetch" href="https://firestore.googleapis.com">');
             }
             if (!content.match(/<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/www\.googleapis\.com["'][^>]*>/i)) {
                 tags.push('    <link rel="preconnect" href="https://www.googleapis.com">');
             }
             if (!content.match(/<link[^>]*rel=["']dns-prefetch["'][^>]*href=["']https:\/\/www\.googleapis\.com["'][^>]*>/i)) {
                 tags.push('    <link rel="dns-prefetch" href="https://www.googleapis.com">');
             }
        }

        // Check for Google Fonts (if it has actual fonts referenced, or fonts.googleapis.com)
        if (content.includes('fonts.googleapis.com')) {
             if (!content.match(/<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/fonts\.googleapis\.com["'][^>]*>/i) && !content.match(/<link[^>]*href=["']https:\/\/fonts\.googleapis\.com["'][^>]*rel=["']preconnect["'][^>]*>/i)) {
                  tags.push('    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>');
             }
             if (!content.match(/<link[^>]*rel=["']preconnect["'][^>]*href=["']https:\/\/fonts\.gstatic\.com["'][^>]*>/i) && !content.match(/<link[^>]*href=["']https:\/\/fonts\.gstatic\.com["'][^>]*rel=["']preconnect["'][^>]*>/i)) {
                  tags.push('    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
             }
        }

        if (tags.length === 0) return;

        const hasHead = /<head>/i.test(content);
        if (hasHead) {
            const tagsString = '\n    <!-- Performance: DNS prefetch and preconnect for external resources -->\n' + tags.join('\n');
            content = content.replace(/<head>/i, `<head>${tagsString}`);

            if (originalContent !== content) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath}`);
            }
        }
    }
});
