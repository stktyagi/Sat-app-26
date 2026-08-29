import { Reel } from '@/types/models';

// Mock Timestamp to avoid depending on Firebase native modules for mock data
const mockTimestamp = {
  seconds: Math.floor(Date.now() / 1000),
  nanoseconds: 0,
  toDate: () => new Date(),
  toMillis: () => Date.now(),
  isEqual: (other: any) => false,
  valueOf: () => Date.now().toString(),
} as any;

export const MOCK_REELS: Reel[] = [
  {
    id: 'reel1',
    videoUrl: require("@/assets/reel1.mp4") as any,
    title: 'Welcome to TechFest 2026!',
    description: 'Get ready for the biggest tech festival of the year. Join us for 3 days of innovation and fun.',
    event: {
      id: 'mock-event-1',
      name: 'Hackathon 2026',
      description: 'The ultimate coding challenge',
      isRegistrationOpen: true,
    },
    duration: 60,
    createdAt: mockTimestamp,
  },
  {
    id: 'reel2',
    videoUrl: require("@/assets/reel2.mp4") as any,
    title: 'Cultural Night Highlights',
    description: 'A glimpse into the amazing performances from last year. You dont want to miss this year!',
    event: {
      id: 'mock-event-2',
      name: 'Cultural Night',
      description: 'Dance and music festival',
      isRegistrationOpen: false,
    },
    duration: 45,
    createdAt: mockTimestamp,
  },
  {
    id: 'reel3',
    videoUrl: require("@/assets/reel3.mp4") as any,
    title: 'Events & More',
    description: 'Compete, learn, and win big prizes.',
    event: { 
      id: 'battle-of-bands', 
      name: 'Battle of the Bands', 
      description: 'Rock out with the best bands', 
      isRegistrationOpen: false 
    },
    duration: 50,
    createdAt: mockTimestamp,
  }
];
