/**
 * Formatting service for event descriptions and other text content.
 * Provides basic Markdown-like formatting and HTML sanitization.
 */

const FormattingService = {
    /**
     * Formats a description string into HTML.
     * Handles:
     * - HTML Escaping (XSS prevention)
     * - Bold: **text** (supports multi-line)
     * - Italic: *text* (supports multi-line)
     * - Links: [text](url) - Protected from mangling
     * - Paragraphs: Double line breaks
     * - Line breaks: Single line breaks
     *
     * @param {string} text The raw description text
     * @returns {string} Formatted HTML string
     */
    formatDescription: function(text) {
        if (!text || typeof text !== 'string') return '';

        // 1. Normalize, Trim and Escape
        let html = text.trim()
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // 2. Links: [text](url) - Process early with placeholders to protect URLs from bold/italic mangling
        const links = [];
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, (match, linkText, url) => {
            // Basic URL validation to ensure it looks like a link
            const isSafeUrl = /^(https?:\/\/|mailto:|\/)/i.test(url);
            if (isSafeUrl) {
                const placeholder = `__LINK_${links.length}__`;
                // Format the linkText as it might contain bold/italic
                const formattedLinkText = this.formatDescriptionPartial(linkText);
                links.push(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline hover:text-[var(--color-toxic)] transition-colors">${formattedLinkText}</a>`);
                return placeholder;
            }
            return match;
        });

        // 3. Bold and Italic (supporting multi-line via 's' flag)
        html = this.formatDescriptionPartial(html);

        // 4. Restore Links
        links.forEach((link, i) => {
            html = html.replace(`__LINK_${i}__`, link);
        });

        // 5. Paragraphs and Line Breaks
        // Split by two or more newlines, which may contain spaces
        return html.split(/\n\s*\n+/).map(para => {
            // Single line breaks within paragraph to <br>
            const lineBroken = para.replace(/\n/g, '<br>');
            return `<p>${lineBroken}</p>`;
        }).join('');
    },

    /**
     * Helper to apply bold and italic formatting.
     */
    formatDescriptionPartial: function(text) {
        let partial = text.replace(/\*\*(.*?)\*\*/gs, '<strong>$1</strong>');
        partial = partial.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/gs, '<em>$1</em>');
        return partial;
    }
};

module.exports = FormattingService;
