import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
} from 'remotion';
import { EventReelProps } from '../types';

export const MinimalistReel: React.FC<EventReelProps> = ({
  event,
  branding,
  settings,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // Animation timings for clean, sequential appearance
  const titleEntrance = interpolate(
    frame,
    [0, 40],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const dividerEntrance = interpolate(
    frame,
    [20, 50],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const detailsEntrance = interpolate(
    frame,
    [40, 80],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const imageEntrance = interpolate(
    frame,
    [60, 100],
    [0, 1],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: branding.backgroundColor,
        fontFamily: branding.fontFamily,
        color: 'white',
        padding: 60,
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(45deg, transparent 0%, rgba(232, 58, 153, 0.05) 100%)`,
        }}
      />
      
      {/* Logo */}
      {settings.includeLogo && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            fontSize: 18,
            fontWeight: '600',
            color: branding.primaryColor,
            letterSpacing: '1px',
          }}
        >
          BRUM OUTLOUD
        </div>
      )}
      
      {/* Main Content Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Event Title */}
        <div
          style={{
            opacity: titleEntrance,
            transform: `translateY(${(1 - titleEntrance) * 30}px)`,
            marginBottom: 30,
          }}
        >
          <h1
            style={{
              fontSize: 56,
              fontWeight: '700',
              margin: 0,
              lineHeight: 1.1,
              maxWidth: '90%',
            }}
          >
            {event.name}
          </h1>
        </div>
        
        {/* Accent Divider */}
        <div
          style={{
            width: `${dividerEntrance * 100}px`,
            height: 4,
            background: `linear-gradient(90deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
            borderRadius: '2px',
            marginBottom: 40,
          }}
        />
        
        {/* Event Details */}
        <div
          style={{
            opacity: detailsEntrance,
            transform: `translateY(${(1 - detailsEntrance) * 20}px)`,
            marginBottom: 50,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: '600',
              marginBottom: 15,
              color: '#EAEAEA',
            }}
          >
            {event.venue.name}
          </div>
          
          <div
            style={{
              fontSize: 24,
              fontWeight: '400',
              color: branding.primaryColor,
              marginBottom: 20,
            }}
          >
            {event.formattedDate}
          </div>
          
          {/* Categories */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '15px',
              flexWrap: 'wrap',
            }}
          >
            {event.category.slice(0, 3).map((cat, index) => (
              <span
                key={cat}
                style={{
                  fontSize: 16,
                  fontWeight: '500',
                  padding: '8px 16px',
                  border: `1px solid ${branding.primaryColor}`,
                  borderRadius: '20px',
                  color: branding.primaryColor,
                  backgroundColor: 'transparent',
                }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
        
        {/* Event Image */}
        <div
          style={{
            opacity: imageEntrance,
            transform: `scale(${0.8 + (imageEntrance * 0.2)})`,
            width: 250,
            height: 250,
            borderRadius: '12px',
            overflow: 'hidden',
            border: `2px solid ${branding.primaryColor}`,
            marginBottom: 40,
          }}
        >
          <Img
            src={event.image}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
        
        {/* Hashtags */}
        {settings.includeHashtags && (
          <div
            style={{
              opacity: detailsEntrance,
              fontSize: 16,
              color: 'rgba(255,255,255,0.6)',
              fontWeight: '400',
            }}
          >
            {event.hashtags.slice(0, 4).join(' ')}
          </div>
        )}
      </div>
      
      {/* Bottom Accent */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
        }}
      />
    </AbsoluteFill>
  );
}; 