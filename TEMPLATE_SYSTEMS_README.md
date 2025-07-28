# 🎯 Template Systems Documentation

This document outlines the template systems used for generating consistent, maintainable pages across the BrumOutLoud website.

## 📋 Overview

We use template systems to ensure:
- **Consistency** across all pages
- **Maintainability** - update once, apply everywhere
- **Reliability** - no manual copy-pasting errors
- **Scalability** - easy to add new pages
- **Version Control** - track template changes

## 🏢 Venue Template System

### 📁 Files
- **`venue-template.html`** - Master template with placeholders
- **`generate-venue-pages.js`** - Generation script
- **`venue/`** - Generated venue pages
- **`VENUE_TEMPLATE_README.md`** - Detailed venue documentation

### 🔧 Placeholders
| Placeholder | Description |
|-------------|-------------|
| `{{VENUE_NAME}}` | Venue name |
| `{{VENUE_SLUG}}` | URL slug |
| `{{VENUE_DESCRIPTION}}` | Short description |
| `{{VENUE_ADDITIONAL_DESCRIPTION}}` | Extended description |
| `{{VENUE_ADDRESS}}` | Full address |
| `{{VENUE_IMAGE_URL}}` | Hero image URL |
| `{{VENUE_WEBSITE_URL}}` | Website URL |
| `{{VENUE_WEBSITE_DISPLAY}}` | Website display name |
| `{{VENUE_STATUS_TEXT}}` | Current status |
| `{{VENUE_HOURS_SUMMARY}}` | Hours summary |
| `{{VENUE_TAGS}}` | HTML venue tags |
| `{{VENUE_OPENING_HOURS}}` | HTML opening hours |

### 🚀 Usage
```bash
# Update all venue pages
node generate-venue-pages.js update-all

# Generate single venue
node generate-venue-pages.js generate <slug>

# List venues
node generate-venue-pages.js list
```

---

## 🎪 Event Template System

### 📁 Files
- **`event-template.html`** - Master template with placeholders
- **`generate-event-pages.js`** - Generation script
- **`event/`** - Generated event pages
- **`EVENT_TEMPLATE_README.md`** - Detailed event documentation

### 🔧 Placeholders
| Placeholder | Description |
|-------------|-------------|
| `{{EVENT_NAME}}` | Event name |
| `{{EVENT_SLUG}}` | URL slug |
| `{{EVENT_DESCRIPTION}}` | Event description |
| `{{EVENT_DATE}}` | Event date |
| `{{EVENT_TIME}}` | Event time |
| `{{EVENT_VENUE_NAME}}` | Venue name |
| `{{EVENT_VENUE_SLUG}}` | Venue slug |
| `{{EVENT_IMAGE_URL}}` | Event image URL |
| `{{EVENT_CATEGORY}}` | Event category |
| `{{EVENT_TAGS}}` | HTML event tags |
| `{{EVENT_ORGANIZER}}` | Event organizer |
| `{{EVENT_WEBSITE_URL}}` | Event website |
| `{{EVENT_TICKET_URL}}` | Ticket purchase URL |
| `{{EVENT_PRICE}}` | Event price |
| `{{EVENT_AGE_RESTRICTION}}` | Age restriction |
| `{{EVENT_ACCESSIBILITY}}` | Accessibility info |
| `{{EVENT_RECURRING_INFO}}` | Recurring event details |

### 🚀 Usage
```bash
# Update all event pages
node generate-event-pages.js update-all

# Generate single event
node generate-event-pages.js generate <slug>

# List events
node generate-event-pages.js list
```

---

## 🔄 Workflow for Template Updates

### 1. Design Changes
When updating the visual design or layout:

1. **Edit the master template** (`venue-template.html` or `event-template.html`)
2. **Test locally** by generating a single page
3. **Update all pages** using the generation script
4. **Review changes** in browser
5. **Commit and push** changes

### 2. Content Changes
When updating venue/event data:

1. **Edit the data array** in the generation script
2. **Run the update script** to regenerate pages
3. **Verify content** is correct
4. **Commit and push** changes

### 3. Adding New Items
When adding new venues or events:

1. **Add data** to the appropriate array in the generation script
2. **Generate the new page** using the single generation command
3. **Verify the page** looks correct
4. **Commit and push** changes

---

## 🎯 Best Practices

### ✅ Do's
- **Always edit the template** for design changes
- **Use the generation scripts** to update pages
- **Test changes** before committing
- **Document new placeholders** when adding them
- **Keep data arrays** in sync with the database

### ❌ Don'ts
- **Never edit generated pages directly** - they'll be overwritten
- **Don't hardcode content** in templates
- **Don't skip testing** before deployment
- **Don't forget to commit** template changes

---

## 🔧 Technical Details

### Template Structure
Each template follows this pattern:
```html
<!DOCTYPE html>
<html>
<head>
    <!-- Meta tags with placeholders -->
    <title>{{ITEM_NAME}} - BrumOutLoud</title>
    <meta name="description" content="{{ITEM_DESCRIPTION}}">
    <!-- ... other meta tags ... -->
</head>
<body>
    <!-- Header (consistent across all pages) -->
    
    <!-- Main content with placeholders -->
    <main>
        <h1>{{ITEM_NAME}}</h1>
        <p>{{ITEM_DESCRIPTION}}</p>
        <!-- ... more content ... -->
    </main>
    
    <!-- Footer (consistent across all pages) -->
    
    <!-- JavaScript with placeholders -->
    <script>
        // Load dynamic content using {{ITEM_SLUG}}
    </script>
</body>
</html>
```

### Generation Script Structure
Each generation script follows this pattern:
```javascript
// Data array with all items
const items = [
    {
        name: 'Item Name',
        slug: 'item-slug',
        description: 'Description',
        // ... other properties
    }
];

// Template reading and replacement
function generatePage(item) {
    let content = template;
    content = content.replace(/\{\{ITEM_NAME\}\}/g, item.name);
    // ... other replacements
    return content;
}

// Command line interface
const command = process.argv[2];
switch (command) {
    case 'update-all':
        updateAllPages();
        break;
    case 'generate':
        generateSinglePage(process.argv[3]);
        break;
    // ... other commands
}
```

---

## 🚀 Future Enhancements

### Planned Improvements
- **API Integration**: Fetch data from Firestore instead of hardcoded arrays
- **Dynamic Content**: Real-time updates for opening hours, event dates
- **Template Versioning**: Track template versions and changes
- **Validation**: Ensure all required placeholders are provided
- **Preview System**: Preview changes before applying to all pages

### Potential New Template Systems
- **Artist/Performer Pages**: For drag artists, musicians, etc.
- **Category Pages**: For event categories (drag, live music, etc.)
- **Location Pages**: For different areas of Birmingham
- **Admin Pages**: For admin interface consistency

---

## 📞 Support

### Common Issues
1. **Placeholder not replaced**: Check spelling and case sensitivity
2. **Page not generating**: Verify venue/event slug exists in data array
3. **Styling issues**: Check template CSS and ensure it's included
4. **Events not loading**: Verify API endpoint in JavaScript

### Getting Help
- Check the specific template README files
- Review the generation script for data structure
- Test with a single page generation first
- Verify all placeholders are properly defined

---

## 📝 Maintenance Checklist

### Weekly
- [ ] Check for new venues/events that need pages
- [ ] Verify all pages are loading correctly
- [ ] Review any template changes needed

### Monthly
- [ ] Update venue/event data arrays
- [ ] Review and update documentation
- [ ] Test generation scripts
- [ ] Backup template files

### Quarterly
- [ ] Review template design for improvements
- [ ] Update placeholder system if needed
- [ ] Optimize generation scripts
- [ ] Plan future enhancements