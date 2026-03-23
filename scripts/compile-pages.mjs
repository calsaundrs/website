import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function compilePages() {
    console.log('🚀 Starting Page Compilation...');

    try {
        // 1. Load Layout and Partials
        const layoutContent = await fs.readFile(path.join(rootDir, 'global', 'layout.hbs'), 'utf8');
        const headerContent = await fs.readFile(path.join(rootDir, 'global', 'header.html'), 'utf8');
        const footerContent = await fs.readFile(path.join(rootDir, 'global', 'footer.html'), 'utf8');

        // 2. Register Partials
        Handlebars.registerPartial('header', headerContent);
        Handlebars.registerPartial('footer', footerContent);

        const template = Handlebars.compile(layoutContent);

        // 3. Process Pages
        const pagesDir = path.join(rootDir, 'src', 'pages');
        const files = await fs.readdir(pagesDir);

        for (const file of files) {
            if (file.endsWith('.html')) {
                console.log(`📄 Compiling ${file}...`);
                const content = await fs.readFile(path.join(pagesDir, file), 'utf8');
                
                // Extract metadata if available (using simple regex for now)
                // Format: <!-- TITLE: My Title -->
                const titleMatch = content.match(/<!--\s*TITLE:\s*(.*?)\s*-->/);
                const descMatch = content.match(/<!--\s*DESCRIPTION:\s*(.*?)\s*-->/);
                const extraHeadMatch = content.match(/<!--\s*EXTRA_HEAD:\s*([\s\S]*?)\s*-->/);
                
                const title = titleMatch ? titleMatch[1] : 'Brum Outloud';
                const description = descMatch ? descMatch[1] : 'Birmingham\'s LGBTQ+ Scene';
                const extraHead = extraHeadMatch ? extraHeadMatch[1] : '';

                // Remove the metadata comments from the content
                let body = content
                    .replace(/<!--\s*TITLE:.*?\s*-->/, '')
                    .replace(/<!--\s*DESCRIPTION:.*?\s*-->/, '')
                    .replace(/<!--\s*EXTRA_HEAD:[\s\S]*?\s*-->/, '');

                const html = template({
                    title,
                    description,
                    extra_head: extraHead,
                    body,
                    path: file.replace('.html', '')
                });

                const outputPath = path.join(rootDir, file);
                await fs.writeFile(outputPath, html, 'utf8');
                console.log(`✅ Generated ${file}`);
            }
        }

        console.log('🎉 Compilation Pipeline Complete!');
    } catch (error) {
        console.error('💥 Compilation Failed:', error);
        process.exit(1);
    }
}

compilePages();
