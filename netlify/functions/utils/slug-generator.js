class SlugGenerator {
  constructor() {
    this.reservedSlugs = new Set(['admin', 'api', 'event', 'events', 'venue', 'venues', 'community', 'contact', 'privacy', 'terms']);
  }

  generateSlug(eventName, options = {}) {
    const { includeDate = false, date = null, seriesId = null } = options;
    
    if (!eventName || typeof eventName !== 'string') {
      throw new Error('Event name is required and must be a string');
    }
    
    // Clean event name
    let slug = eventName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Add series identifier if provided
    if (seriesId) {
      slug = `${slug}-series-${seriesId.slice(-6)}`;
    }
    
    // Add date if requested and provided
    if (includeDate && date) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      slug = `${slug}-${dateStr}`;
    }
    
    // Ensure uniqueness against reserved slugs
    if (this.reservedSlugs.has(slug)) {
      slug = `event-${slug}`;
    }
    
    return slug;
  }

  async ensureUniqueSlug(baseSlug, existingSlugs = []) {
    if (!baseSlug) {
      throw new Error('Base slug is required');
    }
    
    let slug = baseSlug;
    let counter = 1;
    
    while (existingSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
      
      // Prevent infinite loops
      if (counter > 100) {
        throw new Error('Unable to generate unique slug after 100 attempts');
      }
    }
    
    return slug;
  }

  validateSlug(slug) {
    if (!slug || typeof slug !== 'string') {
      return { valid: false, error: 'Slug must be a non-empty string' };
    }
    
    if (slug.length < 3) {
      return { valid: false, error: 'Slug must be at least 3 characters long' };
    }
    
    if (slug.length > 100) {
      return { valid: false, error: 'Slug must be less than 100 characters' };
    }
    
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
    }
    
    if (this.reservedSlugs.has(slug)) {
      return { valid: false, error: 'Slug is reserved' };
    }
    
    return { valid: true };
  }
}

module.exports = SlugGenerator;