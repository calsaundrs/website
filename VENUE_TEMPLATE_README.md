# 🏢 Venue Template System

This system ensures all venue pages are built from a single template, making maintenance and updates much easier.

## 📁 Files

- **`venue-template.html`** - The master template with placeholders
- **`generate-venue-pages.js`** - Script to generate/update venue pages
- **`venue/`** - Directory containing all generated venue pages

## 🔧 Template Placeholders

The template uses these placeholders that get replaced with venue-specific data:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{VENUE_NAME}}` | Venue name | "The Nightingale Club" |
| `{{VENUE_SLUG}}` | URL slug | "the-nightingale-club" |
| `{{VENUE_DESCRIPTION}}` | Short description | "Birmingham's oldest and largest LGBT venue..." |
| `{{VENUE_ADDITIONAL_DESCRIPTION}}` | Extended description | "From drag shows and themed nights..." |
| `{{VENUE_ADDRESS}}` | Full address | "18 Kent Street, Birmingham, B5 6RD, UK" |
| `{{VENUE_IMAGE_URL}}` | Hero image URL | "https://res.cloudinary.com/..." |
| `{{VENUE_WEBSITE_URL}}` | Website URL | "https://nightingaleclub.co.uk/" |
| `{{VENUE_WEBSITE_DISPLAY}}` | Display name for website | "nightingaleclub.co.uk" |
| `{{VENUE_STATUS_TEXT}}` | Current status text | "Open until 3:00 AM" |
| `{{VENUE_HOURS_SUMMARY}}` | Hours summary | "Open Daily 9 PM - 3 AM" |
| `{{VENUE_TAGS}}` | HTML for venue tags | `<span class="...">Nightclub</span>` |
| `{{VENUE_OPENING_HOURS}}` | HTML for opening hours | `<div class="flex justify-between">...` |

## 🚀 Usage

### List all venues
```bash
node generate-venue-pages.js list
```

### Update all venue pages from template
```bash
node generate-venue-pages.js update-all
```

### Generate a single venue page
```bash
node generate-venue-pages.js generate <venue-slug>
```

### Examples
```bash
# List all venues
node generate-venue-pages.js list

# Update all venue pages
node generate-venue-pages.js update-all

# Generate just The Nightingale Club
node generate-venue-pages.js generate the-nightingale-club
```

## 🔄 Workflow for Template Updates

When you need to update the template (e.g., change styling, add new sections):

1. **Edit `venue-template.html`** with your changes
2. **Run the update script**:
   ```bash
   node generate-venue-pages.js update-all
   ```
3. **Commit the changes**:
   ```bash
   git add .
   git commit -m "Update venue template: [describe changes]"
   git push
   ```

## 📝 Adding New Venues

To add a new venue:

1. **Add venue data** to the `venues` array in `generate-venue-pages.js`
2. **Run the generate command**:
   ```bash
   node generate-venue-pages.js generate <new-venue-slug>
   ```

## 🎯 Benefits

- **Consistency**: All venue pages look identical
- **Maintainability**: Update one template, update all pages
- **Reliability**: No more manual copy-pasting
- **Version Control**: Template changes are tracked
- **Scalability**: Easy to add new venues

## 🔍 Current Venues

- Eden Bar (`eden-bar`)
- Equator Bar (`equator-bar`)
- Glamorous (`glamorous`)
- Missing Bar (`missing-bar`)
- Sidewalk (`sidewalk`)
- The Fountain inn (`the-fountain-inn`)
- The Fox (`the-fox`)
- The Nightingale Club (`the-nightingale-club`)
- The Village Inn (`the-village-inn`)

## 🚨 Important Notes

- **Never edit venue pages directly** - they will be overwritten by the template
- **Always edit `venue-template.html`** for design changes
- **Update venue data** in `generate-venue-pages.js` for content changes
- **Test changes** by running the update script before committing

## 🔮 Future Enhancements

- Fetch venue data from API instead of hardcoded array
- Add validation for required fields
- Support for dynamic content (e.g., real-time opening hours)
- Template versioning system