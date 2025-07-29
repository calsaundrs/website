# Event Field Name Analysis

## 🔍 Current Field Name Inconsistencies

### **❌ Major Inconsistencies Found:**

#### **1. Event Name Fields**
- `name` (Firestore standard)
- `'Event Name'` (Airtable legacy)
- `'event-name'` (form submission)

#### **2. Status Fields**
- `status` (Firestore standard)
- `'Status'` (Airtable legacy)
- `'Pending Review'` vs `'pending'` vs `'approved'`

#### **3. Date Fields**
- `date` (Firestore standard)
- `'Date'` (Airtable legacy)
- `'Event Date'` (some forms)

#### **4. Venue Fields**
- `venueName` (Firestore standard)
- `'Venue Name'` (Airtable legacy)
- `venue` (object format)
- `venueId` (reference format)

#### **5. Category Fields**
- `category` (array, Firestore standard)
- `'Category'` (Airtable legacy)
- `categories` (some systems)
- `categoryIds` (form submission)

#### **6. Image Fields**
- `cloudinaryPublicId` (Firestore standard)
- `'Cloudinary Public ID'` (Airtable legacy)
- `promoImage` (some systems)
- `'Promo Image'` (Airtable legacy)
- `image` (generic)

#### **7. Recurring Event Fields**
- `isRecurring` (boolean)
- `recurringPattern` (string)
- `recurringInfo` (string)
- `'Recurring Info'` (Airtable legacy)
- `seriesId` (string)
- `'Series ID'` (Airtable legacy)
- `recurringGroupId` (string)

## 📊 Field Mapping by System

### **Firestore Standard (Target)**
```javascript
{
  name: "Event Name",
  status: "approved",
  date: "2025-01-27T19:00:00Z",
  venueName: "Venue Name",
  category: ["Drag", "Party"],
  cloudinaryPublicId: "cloudinary-id",
  isRecurring: true,
  recurringPattern: "weekly",
  seriesId: "series-123"
}
```

### **Airtable Legacy (Source)**
```javascript
{
  'Event Name': "Event Name",
  'Status': "Approved",
  'Date': "2025-01-27T19:00:00Z",
  'Venue Name': "Venue Name",
  'Category': ["Drag", "Party"],
  'Cloudinary Public ID': "cloudinary-id",
  'Recurring Info': "Every Friday",
  'Series ID': "series-123"
}
```

### **Form Submission (Mixed)**
```javascript
{
  'event-name': "Event Name",
  'venue-name': "Venue Name",
  'categoryIds': "Drag,Party",
  'recurrence': "Every Friday"
}
```

## 🔧 Current Field Handling

### **Functions with Field Mapping:**
1. **`get-events-firestore.js`** - Maps Airtable to Firestore fields
2. **`firestore-event-service.js`** - Comprehensive field mapping
3. **`get-admin-events.js`** - Maps multiple field variations
4. **`event-submission-firestore-only.js`** - Converts form fields to Firestore

### **Functions Needing Updates:**
1. **`get-events-firestore-simple.js`** - Uses mixed field names
2. **`build-events-ssg.js`** - Inconsistent field access
3. **Admin panel forms** - Mixed field naming

## 🎯 Recommended Standardization

### **Target Field Names (Firestore Standard):**
```javascript
{
  // Core Fields
  name: String,
  slug: String,
  description: String,
  date: Date,
  status: String, // 'pending', 'approved', 'rejected'
  
  // Venue
  venueName: String,
  venueId: String,
  venueSlug: String,
  
  // Categorization
  category: Array,
  
  // Media
  cloudinaryPublicId: String,
  promoImage: String,
  
  // Recurring Events
  isRecurring: Boolean,
  recurringPattern: String,
  recurringInfo: String,
  seriesId: String,
  recurringGroupId: String,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date,
  submittedBy: String
}
```

## 🚨 Critical Issues

### **1. Status Field Inconsistency**
- Some events use `'Status': 'Approved'` (Airtable)
- Others use `status: 'approved'` (Firestore)
- Forms submit `'status': 'pending'`

### **2. Image Field Chaos**
- Multiple image field names across system
- Some events have no image fields
- Inconsistent Cloudinary ID storage

### **3. Recurring Event Confusion**
- Multiple recurring field variations
- Inconsistent series management
- Mixed recurring detection logic

## 🔄 Migration Strategy

### **Phase 1: Standardize New Submissions**
- ✅ Update form submission to use standard fields
- ✅ Update admin panel to use standard fields
- ✅ Update SSG to use standard fields

### **Phase 2: Migrate Existing Data**
- 🔄 Create migration function to standardize field names
- 🔄 Update all query functions to use standard fields
- 🔄 Remove legacy field mapping

### **Phase 3: Clean Up**
- 🔄 Remove Airtable field mapping
- 🔄 Standardize all admin functions
- 🔄 Update documentation

## 📋 Action Items

### **Immediate (High Priority):**
1. **Standardize admin panel field names**
2. **Fix status field inconsistencies**
3. **Standardize image field handling**

### **Short Term (Medium Priority):**
1. **Create field migration function**
2. **Update all query functions**
3. **Standardize recurring event fields**

### **Long Term (Low Priority):**
1. **Remove legacy field mapping**
2. **Update documentation**
3. **Add field validation**

## 🎯 Conclusion

**The system currently has significant field name inconsistencies** that need to be addressed. While the current mapping functions work, they create maintenance overhead and potential bugs. 

**Recommendation**: Implement a phased migration to standardize all field names to the Firestore standard format. 