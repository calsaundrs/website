import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
  staticFile,
} from 'remotion';
import { EventReelProps } from '../types';

export const ModernGradientReel: React.FC<EventReelProps> = ({
  event,
  branding,
  settings,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // Animation timings
  const titleEntrance = interpolate(
    frame,
    [0, 30],
    [0, 1],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const venueEntrance = interpolate(
    frame,
    [15, 45],
    [0, 1],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const dateEntrance = interpolate(
    frame,
    [30, 60],
    [0, 1],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const imageScale = interpolate(
    frame,
    [45, 75],
    [0.8, 1],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  
  const hashtagsEntrance = interpolate(
    frame,
    [90, 120],
    [0, 1],
    {
      easing: Easing.out(Easing.quad),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%)`,
        fontFamily: branding.fontFamily,
        color: 'white',
      }}
    >
      {/* Background Pattern */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 50%)
          `,
        }}
      />
      
      {/* Logo */}
      {settings.includeLogo && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 60,
            fontSize: 32,
            fontWeight: 'bold',
            letterSpacing: '2px',
            opacity: 0.9,
          }}
        >
          Brum Outloud
        </div>
      )}
      
      {/* Event Image */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${imageScale})`,
          width: 300,
          height: 300,
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          border: '4px solid rgba(255,255,255,0.2)',
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
      
      {/* Event Title */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${(1 - titleEntrance) * 50}px)`,
          opacity: titleEntrance,
          textAlign: 'center',
          width: '90%',
        }}
      >
        <h1
          style={{
            fontSize: 48,
            fontWeight: 'bold',
            margin: 0,
            textShadow: '0 4px 8px rgba(0,0,0,0.3)',
            lineHeight: 1.2,
          }}
        >
          {event.name}
        </h1>
      </div>
      
      {/* Venue */}
      <div
        style={{
          position: 'absolute',
          top: '65%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${(1 - venueEntrance) * 30}px)`,
          opacity: venueEntrance,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: '600',
            background: 'rgba(255,255,255,0.2)',
            padding: '12px 24px',
            borderRadius: '25px',
            backdropFilter: 'blur(10px)',
          }}
        >
          📍 {event.venue.name}
        </div>
      </div>
      
      {/* Date & Time */}
      <div
        style={{
          position: 'absolute',
          top: '78%',
          left: '50%',
          transform: `translate(-50%, -50%) translateY(${(1 - dateEntrance) * 30}px)`,
          opacity: dateEntrance,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: '500',
            background: 'rgba(0,0,0,0.3)',
            padding: '10px 20px',
            borderRadius: '20px',
            backdropFilter: 'blur(5px)',
          }}
        >
          🗓️ {event.formattedDate}
        </div>
      </div>
      
      {/* Hashtags */}
      {settings.includeHashtags && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: `translate(-50%, 0) translateY(${(1 - hashtagsEntrance) * 20}px)`,
            opacity: hashtagsEntrance,
            textAlign: 'center',
            width: '90%',
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.8)',
              flexWrap: 'wrap',
              gap: '8px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {event.hashtags.slice(0, 5).map((hashtag, index) => (
              <span
                key={hashtag}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  backdropFilter: 'blur(5px)',
                }}
              >
                {hashtag}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Call to Action */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translate(-50%, 0)',
          fontSize: 14,
          fontWeight: '600',
          color: 'rgba(255,255,255,0.7)',
          textAlign: 'center',
        }}
      >
        Follow @brumoutloud for more events
      </div>
    </AbsoluteFill>
  );
}; 