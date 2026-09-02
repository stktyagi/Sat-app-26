import { Reel } from '@/types/models';

export const MOCK_REELS: Reel[] = [
  {
    id: 'reel1',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: 'Welcome to TechFest 2026!',
    description: 'Get ready for the biggest tech festival of the year. Join us for 3 days of innovation and fun.',
    event: {
      id: 'mock-event-1',
      name: 'Hackathon 2026',
      description: 'The ultimate coding challenge',
      isRegistrationOpen: true,
    },
    duration: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'reel2',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    title: 'Cultural Night Highlights',
    description: 'A glimpse into the amazing performances from last year. You dont want to miss this year!',
    event: {
      id: 'mock-event-2',
      name: 'Cultural Night',
      description: 'Dance and music festival',
      isRegistrationOpen: false,
    },
    duration: 45,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'reel3',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    title: 'Events & More',
    description: 'Compete, learn, and win big prizes.',
    event: {
      id: 'battle-of-bands',
      name: 'Battle of the Bands',
      description: 'Rock out with the best bands',
      isRegistrationOpen: false,
    },
    duration: 50,
    createdAt: new Date().toISOString(),
  },
];
