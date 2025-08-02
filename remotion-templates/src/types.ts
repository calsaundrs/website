export interface EventData {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: {
    name: string;
    address: string;
  };
  category: string[];
  image: string;
  hashtags: string[];
  formattedDate: string;
}

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  logoUrl: string;
  fontFamily: string;
}

export interface VideoSettings {
  duration: number;
  includeLogo: boolean;
  includeHashtags: boolean;
  template: string;
}

export interface EventReelProps {
  event: EventData;
  branding: BrandingConfig;
  settings: VideoSettings;
} 