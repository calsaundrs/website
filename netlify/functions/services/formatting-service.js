/**
 * Formatting service for event descriptions and other text content.
 * Provides basic Markdown-like formatting and HTML sanitization.
 */

const FormattingService = {
    /**
     * Formats a description string into HTML.
     * Handles:
     * - HTML Escaping (XSS prevention)
     * - Bold: **text**
     * - Italic: *text*
     * - Links: [text](url)
     * - Paragraphs: Double line breaks
     * - Line breaks: Single line breaks
     *
     * @param {string} text The raw description text
     * @returns {string} Formatted HTML string
     */
    formatDescription: function(text) {
        if (!text || typeof text !== 'string') return '';

        // 1. Basic HTML Escaping
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // 2. Bold: **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // 3. Italic: *text* (only if not preceded/followed by another asterisk to avoid conflict with bold)
        html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

        // 4. Links: [text](url)
        // Ensure the URL is also somewhat safe - we've already escaped & < > " '
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
            // Basic URL validation to ensure it looks like a link
            const isSafeUrl = /^(https?:\/\/|mailto:|\/)/i.test(url);
            if (isSafeUrl) {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--color-toxic)] transition-colors">${linkText}</a>`;
            }
            return match; // Return original if URL doesn't look safe/valid
        });

        // 5. Paragraphs and Line Breaks
        // First, normalize line endings
        html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Double line breaks to paragraphs
        html = html.split(/\n\n+/).map(para => {
            // Single line breaks within paragraph to <br>
            const lineBroken = para.replace(/\n/g, '<br>');
            return `<p>${lineBroken}</p>`;
        }).join('');

        return html;
    }
};

module.exports = FormattingService;
