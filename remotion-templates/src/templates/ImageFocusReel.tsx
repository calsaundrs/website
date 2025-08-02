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

export const ImageFocusReel: React.FC<EventReelProps> = ({
  event,
  branding,
  settings,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // Animation timings
  const imageZoom = interpolate(
    frame,
    [0, 60],
    [1.2, 1],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const overlayEntrance = interpolate(
    frame,
    [30, 70],
    [0, 1],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const titleSlide = interpolate(
    frame,
    [60, 100],
    [100, 0],
    {
      easing: Easing.out(Easing.back(1.7)),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const detailsSlide = interpolate(
    frame,
    [80, 120],
    [50, 0],
    {
      easing: Easing.out(Easing.quad),
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
      }}
    >
      {/* Background Image */}
      <AbsoluteFill
        style={{
          overflow: 'hidden',
        }}
      >
        <Img
          src={event.image}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${imageZoom})`,
            filter: 'brightness(0.6) contrast(1.1)',
          }}
        />
      </AbsoluteFill>
      
      {/* Gradient Overlays */}
      <AbsoluteFill
        style={{
          background: `
            linear-gradient(
              45deg,
              rgba(232, 58, 153, 0.4) 0%,
              rgba(139, 92, 246, 0.4) 100%
            ),
            linear-gradient(
              to top,
              rgba(0, 0, 0, 0.8) 0%,
              transparent 50%,
              rgba(0, 0, 0, 0.6) 100%
            )
          `,
          opacity: overlayEntrance,
        }}
      />
      
      {/* Animated Pattern Overlay */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(
              circle at ${30 + Math.sin(frame / 20) * 10}% ${50 + Math.cos(frame / 15) * 10}%,
              rgba(255, 255, 255, 0.1) 0%,
              transparent 60%
            )
          `,
          opacity: overlayEntrance * 0.5,
        }}
      />
      
      {/* Logo */}
      {settings.includeLogo && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            left: 50,
            fontSize: 24,
            fontWeight: 'bold',
            color: 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            letterSpacing: '1.5px',
            opacity: overlayEntrance,
          }}
        >
          BRUM OUTLOUD
        </div>
      )}
      
      {/* Main Content */}
      <div
        style={{
          position: 'absolute',
          bottom: '30%',
          left: 0,
          right: 0,
          padding: '0 50px',
          textAlign: 'center',
        }}
      >
        {/* Event Title */}
        <div
          style={{
            transform: `translateX(${titleSlide}px)`,
            marginBottom: 30,
          }}
        >
          <h1
            style={{
              fontSize: 52,
              fontWeight: '900',
              margin: 0,
              lineHeight: 1.1,
              textShadow: '0 4px 12px rgba(0,0,0,0.7)',
              background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}
          >
            {event.name}
          </h1>
        </div>
        
        {/* Event Details Box */}
        <div
          style={{
            transform: `translateX(${-detailsSlide}px)`,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '25px 35px',
            border: `2px solid ${branding.primaryColor}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'inline-block',
          }}
        >
          <div
            style={{
              fontSize: 26,
              fontWeight: '700',
              color: branding.primaryColor,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <span>📍</span>
            {event.venue.name}
          </div>
          
          <div
            style={{
              fontSize: 22,
              fontWeight: '600',
              color: 'white',
              marginBottom: 15,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
          >
            <span>🗓️</span>
            {event.formattedDate}
          </div>
          
          {/* Categories Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            {event.category.slice(0, 3).map((cat, index) => (
              <span
                key={cat}
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  padding: '6px 14px',
                  background: `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor})`,
                  borderRadius: '15px',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* Hashtags */}
      {settings.includeHashtags && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: overlayEntrance,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.9)',
              background: 'rgba(0,0,0,0.5)',
              padding: '12px 20px',
              borderRadius: '25px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {event.hashtags.slice(0, 4).join(' ')}
          </div>
        </div>
      )}
      
      {/* Call to Action */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 14,
          fontWeight: '600',
          color: 'rgba(255,255,255,0.8)',
          textAlign: 'center',
          opacity: overlayEntrance,
        }}
      >
        Follow @brumoutloud • Birmingham's LGBTQ+ Events
      </div>
      
      {/* Decorative Corner Elements */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 100,
          height: 100,
          background: `linear-gradient(225deg, ${branding.primaryColor} 0%, transparent 70%)`,
          opacity: overlayEntrance * 0.6,
        }}
      />
      
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 100,
          height: 100,
          background: `linear-gradient(45deg, ${branding.secondaryColor} 0%, transparent 70%)`,
          opacity: overlayEntrance * 0.6,
        }}
      />
    </AbsoluteFill>
  );
}; 