# Firestore Migration Deployment Checklist

## Pre-Deployment Checklist

### ✅ Environment Variables
- [ ] `FIREBASE_PROJECT_ID` is set in Netlify dashboard
- [ ] `FIREBASE_CLIENT_EMAIL` is set in Netlify dashboard  
- [ ] `FIREBASE_PRIVATE_KEY` is set in Netlify dashboard (with proper newline formatting)
- [ ] Variables are set for both production and deploy-preview contexts

### ✅ Firebase Setup
- [ ] Firebase project is created and accessible
- [ ] Service account has been created with proper permissions
- [ ] Events collection exists in Firestore
- [ ] Sample event data is available for testing

### ✅ Code Changes
- [ ] `netlify/functions/services/firestore-event-service.js` is created
- [ ] `netlify/functions/get-event-details-firestore.js` is created
- [ ] `netlify/functions/test-firestore-connection.js` is created
- [ ] `netlify.toml` routing is updated to use new function
- [ ] `FIRESTORE_EVENT_DETAILS_MIGRATION.md` documentation is created

## Deployment Steps

### 1. Deploy to Preview Environment
```bash
# Deploy to Netlify preview
git push origin main
```

### 2. Test Firestore Connection
- [ ] Navigate to: `https://your-preview-url.netlify.app/.netlify/functions/test-firestore-connection`
- [ ] Verify response shows `"success": true`
- [ ] Check that sample events are returned
- [ ] Confirm environment variables are properly set

### 3. Test Event Details Page
- [ ] Navigate to an existing event: `https://your-preview-url.netlify.app/event/your-event-slug`
- [ ] Verify page loads without errors
- [ ] Check that event data displays correctly
- [ ] Test calendar links (Google Calendar and iCal)
- [ ] Verify recurring events work (if applicable)
- [ ] Test similar events functionality

### 4. Performance Testing
- [ ] Check page load times
- [ ] Verify caching is working (check Cache-Control headers)
- [ ] Test with multiple concurrent users
- [ ] Monitor function execution times in Netlify dashboard

### 5. Error Handling
- [ ] Test with non-existent event slugs
- [ ] Verify 404 pages are displayed correctly
- [ ] Check error logs in Netlify function logs
- [ ] Test with malformed data

## Production Deployment

### 1. Final Verification
- [ ] All tests pass in preview environment
- [ ] No critical errors in function logs
- [ ] Performance is acceptable
- [ ] All functionality works as expected

### 2. Deploy to Production
```bash
# Merge to main branch or trigger production deployment
git push origin main
```

### 3. Post-Deployment Verification
- [ ] Test production event pages
- [ ] Monitor function logs for errors
- [ ] Check that Airtable function is no longer being called
- [ ] Verify all existing event URLs still work

## Rollback Plan

### Quick Rollback (if needed)
1. Update `netlify.toml`:
```toml
[[redirects]]
  from = "/event/*"
  to = "/.netlify/functions/get-event-details?slug=:splat"
  status = 200
```

2. Deploy the change
3. Site immediately switches back to Airtable

### Monitoring Checklist
- [ ] Monitor function execution times
- [ ] Check for any 500 errors
- [ ] Verify event pages are loading correctly
- [ ] Monitor Firestore usage and costs
- [ ] Check for any missing events or data issues

## Success Criteria

### ✅ Functional Requirements
- [ ] All event pages load correctly
- [ ] Calendar integration works
- [ ] Recurring events display properly
- [ ] Similar events functionality works
- [ ] No broken links or missing data

### ✅ Performance Requirements
- [ ] Page load times are similar to or better than Airtable version
- [ ] Function execution times are under 5 seconds
- [ ] Caching is working effectively
- [ ] No timeout errors

### ✅ Reliability Requirements
- [ ] No 500 errors in production
- [ ] All existing event URLs work
- [ ] Error handling works correctly
- [ ] Fallback mechanisms are in place

## Post-Migration Tasks

### 1. Cleanup (Optional)
- [ ] Remove old Airtable function if no longer needed
- [ ] Update documentation to reflect new architecture
- [ ] Archive old Airtable credentials

### 2. Optimization
- [ ] Monitor and optimize Firestore queries
- [ ] Implement additional caching if needed
- [ ] Consider implementing real-time updates
- [ ] Plan for future enhancements

### 3. Documentation
- [ ] Update team documentation
- [ ] Create runbooks for common issues
- [ ] Document monitoring and alerting procedures
- [ ] Update deployment procedures

## Emergency Contacts

- **Primary Contact**: [Your Name/Team]
- **Backup Contact**: [Backup Person/Team]
- **Firebase Support**: Firebase Console → Support
- **Netlify Support**: Netlify Dashboard → Help

## Notes

- Keep the original Airtable function available for at least 1 week after successful migration
- Monitor closely for the first 48 hours after production deployment
- Have the rollback plan ready and tested before going live
- Document any issues or learnings for future migrations