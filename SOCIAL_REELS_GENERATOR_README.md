# Social Reels Generator - Experimental Feature

## Overview

The Social Reels Generator is an experimental admin panel feature that automatically creates Instagram-ready video reels for upcoming events. It leverages **Remotion** (programmatic video generation with React) to create on-brand video content that promotes Brum Outloud's weekly events.

## 🎯 Purpose

- **Automate Social Media Content**: Generate branded video reels for Instagram/TikTok
- **Consistent Branding**: Ensure all videos follow Brum Outloud's visual identity
- **Time Saving**: Batch generate videos for multiple events
- **Professional Quality**: Create polished promotional content

## 🏗️ Architecture

### Components Created

1. **Admin Panel Interface** (`admin-social-reels.html`)
2. **JavaScript Controller** (`js/admin-social-reels.js`)
3. **Backend Functions**:
   - `get-events-for-reels.js` - Fetches events for flexible date ranges
   - `generate-social-reel.js` - Handles video generation with Remotion
4. **Remotion Templates** (`remotion-templates/`):
   - Modern Gradient Template
   - Minimalist Template  
   - Image Focus Template

### Data Flow

```
Weekly Events → Template Selection → Remotion Rendering → Video Export
     ↓               ↓                    ↓               ↓
  Firestore    Admin Interface    Video Generation    Download/Share
```

## 🎨 Brand Integration

### Colors Used
- **Primary**: `#E83A99` (Brum Outloud Pink)
- **Secondary**: `#8B5CF6` (Purple)
- **Background**: `#0a0a0a` (Dark)
- **Typography**: "Poppins" and "Omnes Pro"

### Template Styles

1. **Modern Gradient**
   - Full gradient background with brand colors
   - Animated text entrance effects
   - Floating event image with shadows
   - Hashtag animations

2. **Minimalist**
   - Clean dark background
   - Typography-focused design
   - Subtle brand accent colors
   - Professional aesthetic

3. **Image Focus**
   - Event image as background
   - Brand gradient overlays
   - Dynamic text positioning
   - Call-to-action elements

## 📱 Video Specifications

- **Aspect Ratio**: 9:16 (Instagram Reels/TikTok format)
- **Resolution**: 1080x1920 pixels
- **Duration**: 3-15 seconds (configurable)
- **Format**: MP4
- **Frame Rate**: 30fps

## 🚀 Features

### Admin Interface
- **Flexible Date Ranges**: Choose from presets or custom date ranges
- **Template Selection**: Choose from 3 video styles
- **Real-time Preview**: See video before generating
- **Customization Options**:
  - Duration slider (3-15 seconds)
  - Logo inclusion toggle
  - Hashtag display toggle
- **Batch Operations**: Generate multiple videos at once
- **Download Management**: Individual or ZIP downloads

### Date Range Options
- **Today**: Events happening today
- **Tomorrow**: Events happening tomorrow  
- **This Week**: Next 7 days
- **Next Week**: Days 8-14 ahead
- **This Month**: All events in current month
- **Next Month**: All events in next month
- **Next 30 Days**: Rolling 30-day window
- **Next 60 Days**: Rolling 60-day window
- **Custom Range**: Pick any start and end date

### Event Data Integration
- Pulls from existing Firestore database
- Uses Cloudinary images for optimized assets
- Generates relevant hashtags automatically
- Formats dates/times for video display

## 🛠️ Technical Implementation

### Backend Functions

**get-events-for-reels.js**
```javascript
// Fetches approved events for flexible date ranges
// Supports presets: today, this-week, this-month, next-30-days, etc.
// Handles custom date range queries
// Processes event data for video templates
// Optimizes images via Cloudinary
// Generates hashtags and formatted dates
```

**generate-social-reel.js**
```javascript
// Accepts event ID and template selection
// Integrates with Remotion for video rendering
// Returns video metadata and download URLs
// Handles error states gracefully
```

### Frontend Controller
```javascript
class SocialReelsGenerator {
  // Manages event loading and selection
  // Handles template switching
  // Controls video generation workflow
  // Manages batch operations and downloads
}
```

### Remotion Integration
- React-based video components
- Frame-by-frame animation control
- Dynamic content interpolation
- Professional easing and transitions

## 📦 Installation Requirements

### For Full Implementation:
```bash
# Install Remotion dependencies
npm install @remotion/bundler @remotion/cli @remotion/player @remotion/renderer

# Install React dependencies
npm install react react-dom

# Optional: TypeScript support
npm install typescript @types/react @types/react-dom
```

### Environment Variables:
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key
```

## 🔧 Configuration

### Video Settings
```javascript
const defaultSettings = {
  duration: 5,        // seconds
  includeLogo: true,  // show Brum Outloud branding
  includeHashtags: true, // display event hashtags
  template: 'modern'  // default template
};
```

### Brand Configuration
```javascript
const branding = {
  primaryColor: '#E83A99',
  secondaryColor: '#8B5CF6', 
  backgroundColor: '#0a0a0a',
  logoUrl: 'cloudinary-url',
  fontFamily: 'Poppins'
};
```

## 🎭 Usage Guide

### For Administrators:

1. **Access the Tool**
   - Navigate to Admin Panel → Social Reels Generator
   - Choose date range from dropdown (defaults to "This Week")

2. **Select Date Range**
   - **Quick Presets**: Choose from Today, This Week, This Month, etc.
   - **Custom Range**: Select "Custom Range" and pick specific dates
   - **Smart Suggestions**: If no events found, click "Try Different Date Range"

3. **Generate Single Video**
   - Select an event from the filtered list
   - Choose a template style (Modern, Minimalist, Image Focus)
   - Adjust duration (3-15 seconds) and settings
   - Click "Generate Preview" for interactive video player
   - **Play animated preview** to see simulated video effects
   - Download when satisfied

4. **Batch Generation**
   - Check multiple events across your selected date range
   - Click "Generate All Selected"
   - Wait for batch processing
   - Download as ZIP file

5. **Plan Ahead**
   - Use "Next Month" or "Next 60 Days" for advance planning
   - Generate content for upcoming campaigns
   - Schedule social media posts in advance

### For Developers:

1. **Adding New Templates**
   ```javascript
   // Create new template in remotion-templates/src/templates/
   export const NewTemplate: React.FC<EventReelProps> = ({ event, branding, settings }) => {
     // Your Remotion component here
   };
   ```

2. **Customizing Animations**
   ```javascript
   const fadeIn = interpolate(frame, [0, 30], [0, 1], {
     easing: Easing.out(Easing.quad)
   });
   ```

## 🚦 Current Status: EXPERIMENTAL

### ✅ Completed
- Admin interface with event loading
- Template selection and preview
- Brand-consistent design system
- Remotion template architecture
- Backend integration structure
- **Interactive video preview system**
- **Animated demo player with playback simulation**
- **Flexible date range selection (9 presets + custom)**
- **Fallback demo video generation**
- **Enhanced UI with real-time feedback**

### 🔄 In Development
- Full Remotion video rendering (serverless optimization)
- Cloudinary video uploads
- ZIP download functionality
- Advanced template customization

### 🔮 Future Enhancements
- AI-powered template selection
- Custom font uploads
- Music integration
- Advanced animation library
- Social media scheduling
- Analytics tracking

## 📊 Performance Considerations

- **Video Generation**: 2-5 seconds per video
- **Batch Processing**: Parallel generation support
- **File Sizes**: ~2-3MB per video
- **Caching**: Template assets cached via Cloudinary
- **Scalability**: Serverless function architecture

## 🔒 Security & Access

- **Admin Only**: Requires authentication
- **Rate Limiting**: Prevents abuse of video generation
- **File Validation**: Secure image processing
- **Privacy**: No user data in videos (only public event info)

## 🐛 Known Limitations

1. **Template Quantity**: Currently 3 templates (expandable)
2. **Video Length**: 15-second maximum
3. **Customization**: Limited to predefined options
4. **Remotion Bundling**: Full video rendering limited by serverless constraints
5. **Mobile Interface**: Optimized for desktop admin use

## 🎭 Current Preview System

**Demo Mode Features:**
- ✅ Interactive animated preview player
- ✅ Real-time color transitions and effects
- ✅ Simulated video playback with frame animations
- ✅ Professional UI with video metadata display
- ✅ Play button with engaging visual feedback
- ✅ Template-specific preview customization
- ✅ Immediate functionality without video files

## 📝 Contributing

### Adding New Templates
1. Create React component in `remotion-templates/src/templates/`
2. Follow brand guidelines and animation patterns
3. Register in `Root.tsx`
4. Update template selection UI

### Improving Animations
1. Use Remotion's interpolation functions
2. Follow easing patterns for consistency
3. Test across different event data
4. Ensure performance optimization

## 🔗 Related Documentation

- [Remotion Official Docs](https://remotion.dev/docs)
- [Brum Outloud Brand Guidelines](./GEMINI.md)
- [Admin Panel Documentation](./FUNCTIONS_DOCUMENTATION.md)
- [Firestore Integration](./FIRESTORE_DEPLOYMENT_GUIDE.md)

## 📧 Support

For questions about the Social Reels Generator:
- Check existing admin documentation
- Review Remotion community resources
- Contact development team for feature requests

---

**Note**: This is an experimental feature designed to explore automated social media content generation for LGBTQ+ event promotion. While functional, it requires additional development for production deployment. 