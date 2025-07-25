# Migration Files Quick Reference

## Files Created

### 1. `netlify/functions/full-migration.js`
**Main migration function** that handles the complete data transfer from Airtable to Firestore.

**Features:**
- Migrates Venues, Events, and System Notifications
- Handles relationships between data
- Rate limiting and batch processing
- Comprehensive error handling
- Detailed progress reporting

**Usage:**
```bash
# Via web interface
Navigate to /admin/migration

# Via API
POST /.netlify/functions/full-migration
Authorization: Bearer YOUR_TOKEN
```

### 2. `netlify/functions/test-migration-setup.js`
**Setup verification function** to test all connections and environment variables before migration.

**Usage:**
```bash
GET /.netlify/functions/test-migration-setup
```

### 3. `full-migration-trigger.html`
**Web interface** for triggering and monitoring the migration process.

**Access:** `/admin/migration`

### 4. `MIGRATION_GUIDE.md`
**Comprehensive documentation** with setup instructions, troubleshooting, and best practices.

## Quick Start

1. **Set Environment Variables** in Netlify dashboard:
   ```
   AIRTABLE_PERSONAL_ACCESS_TOKEN=your_token
   AIRTABLE_BASE_ID=your_base_id
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=your_client_email
   FIREBASE_PRIVATE_KEY=your_private_key
   ```

2. **Test Setup:**
   ```
   GET https://your-site.netlify.app/.netlify/functions/test-migration-setup
   ```

3. **Run Migration:**
   ```
   Navigate to https://your-site.netlify.app/admin/migration
   ```

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `AIRTABLE_PERSONAL_ACCESS_TOKEN` | Airtable API token | ✅ |
| `AIRTABLE_BASE_ID` | Airtable base ID | ✅ |
| `FIREBASE_PROJECT_ID` | Firebase project ID | ✅ |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | ✅ |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | ✅ |
| `MIGRATION_TOKEN` | Optional: Custom migration token | ❌ |

## Collections Created

- `venues` - All venue data from Airtable
- `events` - All event data from Airtable  
- `systemNotifications` - All system notification data from Airtable

## Important Notes

⚠️ **This is a ONE-TIME migration function**
- Do not run multiple times
- Remove after successful migration
- Keep Airtable data until verification complete

🔒 **Security**
- Function requires Bearer token authentication
- All credentials stored in environment variables
- Access restricted to admin users

📊 **Monitoring**
- Check Netlify function logs for detailed progress
- Monitor Firestore usage and costs
- Verify data integrity after migration

## Support

For issues:
1. Check the test function output
2. Review console logs
3. Verify environment variables
4. See `MIGRATION_GUIDE.md` for detailed troubleshooting