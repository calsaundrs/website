import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const newHeader = `    <header
        class="p-6 sticky top-0 z-[100] bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
        <nav class="container mx-auto flex justify-between items-center max-w-7xl">
            <!-- Site name with consolidated flag image and fallback -->
            <a href="/" class="flex items-center text-3xl font-extrabold tracking-tight text-white group"
                style="font-family: 'Outfit', sans-serif;">
                <span
                    class="bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 group-hover:to-pink-400 transition-all duration-300">Brum
                    Outloud</span>
                <!-- Consolidated flag image: tries to load header_flag.png, falls back to emoji placeholder -->
                <img src="/progressflag.svg.png" alt="LGBTQ+ Flag"
                    class="h-6 w-auto ml-3 inline-block rounded-sm drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onerror="this.src='https://placehold.co/24x24/000000/FFFFFF?text=🏳️‍🌈'; this.onerror=null;"
                    onload="document.body.classList.add('flag-loaded')">
            </a>
            <div class="hidden lg:flex items-center space-x-8 font-medium text-sm tracking-wide">
                <a href="/events.html" class="text-zinc-400 hover:text-white transition-colors duration-200">WHAT'S ON</a>
                <a href="/all-venues.html"
                    class="text-zinc-400 hover:text-white transition-colors duration-200">VENUES</a>
                <a href="/community.html"
                    class="text-zinc-400 hover:text-white transition-colors duration-200">COMMUNITY</a>
                <a href="/contact.html"
                    class="text-zinc-400 hover:text-white transition-colors duration-200">CONTACT</a>
                <a href="/promoter-tool.html" class="nav-cta ml-4">
                    GET LISTED
                </a>
            </div>
            <div class="lg:hidden relative z-[60]">
                <button id="menu-btn" class="btn-menu text-white text-2xl group flex flex-col gap-1.5 p-2"
                    aria-label="Menu">
                    <span class="w-6 h-0.5 bg-white rounded-full transition-all group-hover:bg-pink-400"></span>
                    <span class="w-6 h-0.5 bg-white rounded-full transition-all group-hover:bg-pink-400"></span>
                    <span
                        class="w-4 h-0.5 bg-white rounded-full transition-all group-hover:bg-pink-400 self-end"></span>
                </button>
            </div>
        </nav>
        <div id="menu"
            class="hidden lg:hidden fixed inset-0 bg-[#09090b]/95 backdrop-blur-2xl z-50 flex-col items-center justify-center space-y-8 font-semibold">
            <a href="/events.html" class="block text-white text-3xl hover:text-pink-400 transition-colors">WHAT'S ON</a>
            <a href="/all-venues.html"
                class="block text-white text-3xl hover:text-pink-400 transition-colors">VENUES</a>
            <a href="/community.html"
                class="block text-white text-3xl hover:text-pink-400 transition-colors">COMMUNITY</a>
            <a href="/contact.html" class="block text-white text-3xl hover:text-pink-400 transition-colors">CONTACT</a>
            <a href="/promoter-tool.html" class="nav-cta mt-8 text-xl px-10 py-4 shadow-pink-500/20 shadow-xl">
                GET LISTED
            </a>
        </div>
    </header>`;

const fontImportOutfit = `<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">`;

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir(__dirname, function (filePath) {
    if (filePath.endsWith('.html') && !filePath.includes('node_modules')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Replace old header
        if (content.includes('<header class="p-8">')) {
            content = content.replace(/<header class="p-8">[\s\S]*?<\/header>/, newHeader);
            modified = true;
        }

        // Replace poppins/anton font links with outfit if needed, or add it globally if not present and if there's an existing google font
        if (content.match(/<link[^>]*family=Poppins[^>]*>/i)) {
            content = content.replace(/<link[^>]*family=Poppins[^>]*>/gi, fontImportOutfit);
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated: ${filePath}`);
        }
    }
});
