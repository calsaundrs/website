# Complete Firestore Migration Guide

## Overview

This guide covers the complete migration of all Airtable data sources to Firestore while maintaining the current Client-Side Rendering (CSR) approach and existing HTML design.

## ✅ **Completed Migrations**

### 1. Event Details Page
- **Original**: `get-event-details.js` (Airtable)
- **New**: `get-event-details-firestore.js` (Firestore)
- **Service**: `firestore-event-service.js`
- **Status**: ✅ Complete

### 2. Events Listing
- **Original**: `get-events.js` (Airtable)
- **New**: `get-events-firestore.js` (Firestore)
- **Status**: ✅ Complete

### 3. Venue Details Page
- **Original**: `get-venue-details.js` (Airtable)
- **New**: `get-venue-details-firestore.js` (Firestore)
- **Status**: ✅ Complete

### 4. Sitemap Generation
- **Original**: `sitemap.js` (Airtable)
- **New**: `sitemap-firestore.js` (Firestore)
- **Status**: ✅ Complete

### 5. Admin Pending Items
- **Original**: `get-pending-items.js` (Airtable)
- **New**: `get-pending-items-firestore.js` (Firestore)
- **Status**: ✅ Complete

### 6. System Settings
- **Original**: `get-settings.js` (Airtable)
- **New**: `get-settings-firestore.js` (Firestore)
- **Status**: ✅ Complete

## 🔄 **Remaining Functions to Migrate**

### High Priority (Core Functionality)

#### 1. Event Submission
- **File**: `event-submission.js`
- **Purpose**: Handle new event submissions
- **Status**: ⏳ Pending
- **Priority**: High

#### 2. Venue Submission
- **File**: `venue-submission.js`
- **Purpose**: Handle new venue submissions
- **Status**: ⏳ Pending
- **Priority**: High

#### 3. Event Status Updates
- **File**: `update-item-status.js`
- **Purpose**: Approve/reject events and venues
- **Status**: ⏳ Pending
- **Priority**: High

#### 4. Event Creation (Admin)
- **File**: `create-approved-event.js` / `create-approved-event-v2.js`
- **Purpose**: Create events from admin panel
- **Status**: ⏳ Pending
- **Priority**: High

#### 5. Venue Creation (Admin)
- **File**: `create-approved-venue.js`
- **Purpose**: Create venues from admin panel
- **Status**: ⏳ Pending
- **Priority**: High

### Medium Priority (Admin Functions)

#### 6. Event Categories
- **File**: `update-event-categories.js`
- **Purpose**: Update event categories
- **Status**: ⏳ Pending
- **Priority**: Medium

#### 7. Recurring Events
- **File**: `approve-recurring-series.js`, `update-recurring-events.js`, `update-recurring-series.js`
- **Purpose**: Handle recurring event series
- **Status**: ⏳ Pending
- **Priority**: Medium

#### 8. Event Archiving
- **File**: `archive-event.js`
- **Purpose**: Archive old events
- **Status**: ⏳ Pending
- **Priority**: Medium

#### 9. Settings Updates
- **File**: `update-settings.js`
- **Purpose**: Update system settings
- **Status**: ⏳ Pending
- **Priority**: Medium

### Low Priority (Utility Functions)

#### 10. Count Functions
- **Files**: `get-events-count.js`, `get-venues-count.js`
- **Purpose**: Get counts for dashboard
- **Status**: ⏳ Pending
- **Priority**: Low

#### 11. Debug Functions
- **Files**: `debug-events.js`, `debug-venues.js`, `debug-event-fields.js`, etc.
- **Purpose**: Debugging and testing
- **Status**: ⏳ Pending
- **Priority**: Low

#### 12. Migration Functions
- **Files**: `migrate-data.js`, `migrate-event-data.js`, etc.
- **Purpose**: Data migration utilities
- **Status**: ⏳ Pending
- **Priority**: Low

## 🚀 **Migration Strategy**

### Phase 1: Core Read Functions ✅ COMPLETE
- Event details
- Events listing
- Venue details
- Sitemap generation

### Phase 2: Admin Read Functions ✅ COMPLETE
- Pending items
- System settings

### Phase 3: Write Functions (Next)
- Event submission
- Venue submission
- Status updates
- Event/venue creation

### Phase 4: Admin Management (Future)
- Category updates
- Recurring events
- Archiving
- Settings updates

### Phase 5: Utilities (Future)
- Count functions
- Debug functions
- Migration utilities

## 📋 **Implementation Checklist**

### For Each Function Migration:

1. **Create Firestore Version**
   - [ ] Create `function-name-firestore.js`
   - [ ] Implement Firestore queries
   - [ ] Maintain same API interface
   - [ ] Add proper error handling
   - [ ] Add logging

2. **Update Routing (if needed)**
   - [ ] Update `netlify.toml` if function has direct routing
   - [ ] Update JavaScript files that call the function
   - [ ] Update admin pages that use the function

3. **Test Functionality**
   - [ ] Test with sample data
   - [ ] Verify error handling
   - [ ] Check performance
   - [ ] Validate output format

4. **Deploy and Monitor**
   - [ ] Deploy to preview environment
   - [ ] Test in staging
   - [ ] Monitor function logs
   - [ ] Deploy to production

## 🔧 **Firestore Data Structure**

### Events Collection
```javascript
{
  id: "document-id",
  name: "Event Name",
  slug: "event-slug",
  description: "Event description",
  date: "2025-01-27T19:00:00Z",
  category: ["Drag", "Party"],
  venueId: "venue-id",
  venue: {
    id: "venue-id",
    name: "Venue Name",
    address: "Venue Address"
  },
  image: {
    url: "https://image-url.com",
    publicId: "cloudinary-public-id"
  },
  price: "£10",
  ageRestriction: "18+",
  link: "https://event-link.com",
  recurringInfo: "Every Friday",
  seriesId: "series-id",
  status: "pending|approved|rejected",
  createdAt: "2025-01-27T10:00:00Z",
  updatedAt: "2025-01-27T10:00:00Z",
  submittedBy: "user-id",
  approvedBy: "admin-id",
  approvedAt: "2025-01-27T10:00:00Z"
}
```

### Venues Collection
```javascript
{
  id: "document-id",
  name: "Venue Name",
  slug: "venue-slug",
  description: "Venue description",
  address: "Venue Address",
  link: "https://venue-website.com",
  image: {
    url: "https://image-url.com",
    publicId: "cloudinary-public-id"
  },
  category: ["Bar", "Club"],
  openingHours: "Mon-Sat: 10pm-3am",
  status: "pending|approved|rejected",
  createdAt: "2025-01-27T10:00:00Z",
  updatedAt: "2025-01-27T10:00:00Z",
  submittedBy: "user-id",
  approvedBy: "admin-id",
  approvedAt: "2025-01-27T10:00:00Z"
}
```

### Settings Collection
```javascript
{
  id: "setting-key",
  value: "setting-value",
  description: "Setting description",
  updatedAt: "2025-01-27T10:00:00Z",
  updatedBy: "admin-id"
}
```

## 🛠 **Common Patterns for Migration**

### Reading Data
```javascript
// Get single document
const doc = await db.collection('collection').doc(id).get();
const data = { id: doc.id, ...doc.data() };

// Query with filters
const snapshot = await db.collection('collection')
  .where('field', '==', 'value')
  .orderBy('date', 'desc')
  .limit(10)
  .get();

// Process results
const items = [];
snapshot.forEach(doc => {
  items.push({ id: doc.id, ...doc.data() });
});
```

### Writing Data
```javascript
// Create new document
const docRef = await db.collection('collection').add({
  field1: 'value1',
  field2: 'value2',
  createdAt: new Date(),
  updatedAt: new Date()
});

// Update existing document
await db.collection('collection').doc(id).update({
  field1: 'new-value',
  updatedAt: new Date()
});

// Set document (create or update)
await db.collection('collection').doc(id).set({
  field1: 'value1',
  field2: 'value2',
  updatedAt: new Date()
}, { merge: true });
```

## 📊 **Performance Considerations**

### Indexing
- Create composite indexes for complex queries
- Index frequently queried fields
- Consider query patterns when designing indexes

### Caching
- Use Firestore's built-in caching
- Implement application-level caching where appropriate
- Set appropriate Cache-Control headers

### Pagination
- Use `limit()` and `offset()` for large datasets
- Consider cursor-based pagination for better performance
- Implement proper pagination in frontend

## 🔍 **Testing Strategy**

### Unit Testing
- Test individual functions with mock data
- Verify error handling
- Test edge cases

### Integration Testing
- Test with real Firestore data
- Verify API compatibility
- Test performance with realistic data volumes

### End-to-End Testing
- Test complete user workflows
- Verify frontend integration
- Test admin functionality

## 📈 **Monitoring and Maintenance**

### Function Monitoring
- Monitor execution times
- Track error rates
- Monitor Firestore usage

### Performance Monitoring
- Track query performance
- Monitor cache hit rates
- Watch for slow queries

### Cost Monitoring
- Monitor Firestore read/write costs
- Track function execution costs
- Optimize based on usage patterns

## 🚨 **Rollback Plan**

### Quick Rollback
1. Update `netlify.toml` to use original functions
2. Deploy the change
3. Site immediately switches back to Airtable

### Data Rollback
1. Keep Airtable data as backup
2. Implement data sync if needed
3. Maintain parallel systems during transition

## 📞 **Support and Resources**

### Documentation
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Netlify Functions Documentation](https://docs.netlify.com/functions/build-with-javascript/)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)

### Tools
- Firebase Console for data management
- Netlify Dashboard for function monitoring
- Firebase CLI for local development

### Best Practices
- Follow Firestore security rules
- Implement proper error handling
- Use transactions for data consistency
- Monitor costs and performance

## 🎯 **Success Metrics**

### Performance
- [ ] Function execution times < 5 seconds
- [ ] Page load times maintained or improved
- [ ] No timeout errors

### Reliability
- [ ] 99.9% uptime
- [ ] No data loss
- [ ] Proper error handling

### Cost
- [ ] Firestore costs within budget
- [ ] Function execution costs reasonable
- [ ] Optimized query patterns

### User Experience
- [ ] No visible changes to users
- [ ] All functionality preserved
- [ ] Admin tools working correctly