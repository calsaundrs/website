# 🎪 Event Template System

This system ensures all event pages are built from a single template, making maintenance and updates much easier.

## 📁 Files

- **`event-template.html`** - The master template with placeholders
- **`generate-event-pages.js`** - Script to generate/update event pages
- **`event/`** - Directory containing all generated event pages

## 🔧 Template Placeholders

The template uses these placeholders that get replaced with event-specific data:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{EVENT_NAME}}` | Event name | "Drag Queen Bingo Night" |
| `{{EVENT_SLUG}}` | URL slug | "drag-queen-bingo-night" |
| `{{EVENT_DESCRIPTION}}` | Event description | "Join us for an evening of fabulous drag performances..." |
| `{{EVENT_DATE}}` | Formatted event date | "Monday, 15 January 2024 at 7:00 PM" |
| `{{EVENT_TIME}}` | Event time | "7:00 PM" |
| `{{EVENT_VENUE_NAME}}` | Venue name | "The Nightingale Club" |
| `{{EVENT_VENUE_SLUG}}` | Venue slug | "the-nightingale-club" |
| `{{EVENT_IMAGE_URL}}` | Event image URL | "https://res.cloudinary.com/..." |
| `{{EVENT_CATEGORY}}` | Event category | "Drag" |
| `{{EVENT_TAGS}}` | HTML event tags | `<span class="category-tag">Drag</span>` |
| `{{EVENT_ORGANIZER}}` | Event organizer | "The Nightingale Club" |
| `{{EVENT_WEBSITE_URL}}` | Event website | "https://nightingaleclub.co.uk/events" |
| `{{EVENT_TICKET_URL}}` | Ticket purchase URL | "https://nightingaleclub.co.uk/tickets" |
| `{{EVENT_PRICE}}` | Event price | "£5 entry" |
| `{{EVENT_AGE_RESTRICTION}}` | Age restriction | "18+" |
| `{{EVENT_ACCESSIBILITY}}` | Accessibility info | "Wheelchair accessible" |
| `{{EVENT_RECURRING_INFO}}` | Recurring event details | "Every Monday" |

## 🔧 Conditional Sections

The template also supports conditional sections that can be empty or contain content:

| Section | Description |
|---------|-------------|
| `{{EVENT_DESCRIPTION_SECTION}}` | Full description section with HTML |
| `{{EVENT_LINKS_SECTION}}` | Event links and external URLs |
| `{{EVENT_OTHER_INSTANCES_SECTION}}` | Other instances for recurring events |
| `{{EVENT_PRICE_SECTION}}` | Price information in sidebar |
| `{{EVENT_AGE_RESTRICTION_SECTION}}` | Age restriction in sidebar |
| `{{EVENT_ORGANIZER_SECTION}}` | Organizer information in sidebar |
| `{{EVENT_RECURRING_INFO_SECTION}}` | Recurring info in sidebar |
| `{{EVENT_ACCESSIBILITY_SECTION}}` | Accessibility info in sidebar |
| `{{EVENT_TICKET_BUTTON}}` | Ticket purchase button |
| `{{EVENT_RECURRING_BADGE}}` | Recurring event badge |
| `{{EVENT_BOOSTED_BADGE}}` | Boosted listing badge |
| `{{EVENT_GOOGLE_CALENDAR_URL}}` | Google Calendar link |
| `{{EVENT_ICAL_URL}}` | iCal download link |

## 🚀 Usage

### List all events
```bash
node generate-event-pages.js list
```

### Update all event pages from template
```bash
node generate-event-pages.js update-all
```

### Generate a single event page
```bash
node generate-event-pages.js generate <event-slug>
```

### Examples
```bash
# List all events
node generate-event-pages.js list

# Update all event pages
node generate-event-pages.js update-all

# Generate just Drag Queen Bingo Night
node generate-event-pages.js generate drag-queen-bingo-night
```

## 🔄 Workflow for Template Updates

When you need to update the template (e.g., change styling, add new sections):

1. **Edit `event-template.html`** with your changes
2. **Run the update script**:
   ```bash
   node generate-event-pages.js update-all
   ```
3. **Commit the changes**:
   ```bash
   git add .
   git commit -m "Update event template: [describe changes]"
   git push
   ```

## 📝 Adding New Events

To add a new event:

1. **Add event data** to the `events` array in `generate-event-pages.js`
2. **Run the generate command**:
   ```bash
   node generate-event-pages.js generate <new-event-slug>
   ```

### Event Data Structure

Each event in the array should have this structure:

```javascript
{
    name: 'Event Name',
    slug: 'event-slug',
    description: 'Event description',
    date: '2024-01-15T19:00:00Z',
    time: '7:00 PM',
    venueName: 'Venue Name',
    venueSlug: 'venue-slug',
    imageUrl: 'https://example.com/image.jpg',
    category: 'Category',
    tags: ['<span class="category-tag">Tag</span>'],
    organizer: 'Organizer Name',
    websiteUrl: 'https://example.com',
    ticketUrl: 'https://example.com/tickets',
    price: '£5 entry',
    ageRestriction: '18+',
    accessibility: 'Wheelchair accessible',
    recurringInfo: 'Every Monday',
    isRecurring: true,
    isBoosted: false,
    // Conditional sections
    descriptionSection: '<div>...</div>',
    linksSection: '<div>...</div>',
    otherInstancesSection: '',
    priceSection: '<div>...</div>',
    ageRestrictionSection: '<div>...</div>',
    organizerSection: '<div>...</div>',
    recurringInfoSection: '<div>...</div>',
    accessibilitySection: '<div>...</div>',
    ticketButton: '<a>...</a>',
    recurringBadge: '<span>...</span>',
    boostedBadge: '',
    googleCalendarUrl: 'https://calendar.google.com/...',
    icalUrl: 'data:text/calendar;...'
}
```

## 🎯 Benefits

- **Consistency**: All event pages look identical
- **Maintainability**: Update one template, update all pages
- **Reliability**: No more manual copy-pasting
- **Version Control**: Template changes are tracked
- **Scalability**: Easy to add new events

## 🔍 Current Events

- Drag Queen Bingo Night (`drag-queen-bingo-night`)
- Live Music Night (`live-music-night`)

## 🚨 Important Notes

- **Never edit event pages directly** - they will be overwritten by the template
- **Always edit `event-template.html`** for design changes
- **Update event data** in `generate-event-pages.js` for content changes
- **Test changes** by running the update script before committing

## 🎨 Design Features

### Event Cards
- Hero image with aspect ratio 16:9
- Event tags and badges (recurring, boosted)
- Calendar integration (Google Calendar + iCal)
- Responsive design
- Glassmorphism styling

### Sidebar Information
- Date and time
- Venue with link
- Price information
- Age restrictions
- Organizer details
- Accessibility information
- Ticket purchase button

### Special Features
- **Recurring Events**: Special badge and recurring info
- **Boosted Listings**: Highlighted with special badge
- **Calendar Integration**: One-click add to calendar
- **Venue Linking**: Direct links to venue pages
- **Social Sharing**: Share buttons for events

## 🔮 Future Enhancements

- Fetch event data from Firestore instead of hardcoded array
- Add validation for required fields
- Support for dynamic content (e.g., real-time ticket availability)
- Template versioning system
- Integration with event submission system
- Support for event galleries and multiple images
- Advanced recurring event patterns
- Event search and filtering
- Event recommendations

## 🔧 Technical Details

### Date Formatting
Events use ISO 8601 date format (`2024-01-15T19:00:00Z`) which gets formatted to user-friendly display:
- Input: `2024-01-15T19:00:00Z`
- Output: `Monday, 15 January 2024 at 7:00 PM`

### Calendar Integration
Each event generates:
- **Google Calendar URL**: Direct link to add to Google Calendar
- **iCal File**: Downloadable .ics file for other calendar apps

### Image Handling
- Events use Cloudinary URLs for optimized images
- Fallback to Unsplash placeholder images
- Responsive image loading with lazy loading

### SEO Optimization
- Meta tags for social sharing
- Structured data for search engines
- Clean URLs with event slugs
- Descriptive page titles and descriptions