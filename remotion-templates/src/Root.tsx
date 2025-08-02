import React from 'react';
import { Composition } from 'remotion';
import { ModernGradientReel } from './templates/ModernGradientReel';
import { MinimalistReel } from './templates/MinimalistReel';
import { ImageFocusReel } from './templates/ImageFocusReel';
import { EventReelProps } from './types';

// Default props for development/preview
const defaultProps: EventReelProps = {
  event: {
    id: 'sample-event',
    name: 'Queer Comedy Night',
    description: 'Join us for an evening of laughter with Birmingham\'s funniest LGBTQ+ comedians',
    date: '2025-01-25T20:00:00.000Z',
    venue: {
      name: 'The Nightingale Club',
      address: '1 Kent Street, Birmingham B5 6RD'
    },
    category: ['Comedy', 'Entertainment'],
    image: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/f_auto,q_auto,w_1080,h_1080,c_fill,g_center/sample-event.jpg',
    hashtags: ['#BrumOutLoud', '#LGBTQ', '#Birmingham', '#Comedy', '#NightingaleClub'],
    formattedDate: 'Saturday 25 January 20:00'
  },
  branding: {
    primaryColor: '#E83A99',
    secondaryColor: '#8B5CF6',
    backgroundColor: '#0a0a0a',
    logoUrl: 'https://res.cloudinary.com/dbxhpjoiz/image/upload/v1/brumoutloud_logo.png',
    fontFamily: 'Poppins'
  },
  settings: {
    duration: 5,
    includeLogo: true,
    includeHashtags: true,
    template: 'modern'
  }
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ModernGradientReel"
        component={ModernGradientReel}
        durationInFrames={150} // 5 seconds at 30fps
        fps={30}
        width={1080}
        height={1920} // 9:16 aspect ratio for Instagram Reels
        defaultProps={defaultProps}
      />
      <Composition
        id="MinimalistReel"
        component={MinimalistReel}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
      <Composition
        id="ImageFocusReel"
        component={ImageFocusReel}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
    </>
  );
}; 