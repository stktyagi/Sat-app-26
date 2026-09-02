import { FirebaseEvent } from '@/types/models';

export const MOCK_EVENTS: FirebaseEvent[] = [
  {
    eventId: "mock_event_1",
    title: "Hackathon 2026",
    description: "The biggest hackathon of the year. Build amazing projects and win prizes!",
    shortDescription: "Build amazing projects and win prizes!",
    category: "Technical",
    coordinators: [
      {
        email: "coord1@example.com",
        name: "Alice",
        phone: "1234567890",
        userID: "user_1"
      }
    ],
    coverImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1740&auto=format&fit=crop",
    customFields: [],
    dateTime: new Date(Date.now() + 86400000).toISOString(),
    endDateTime: new Date(Date.now() + 86400000 * 2).toISOString(),
    startDateTime: new Date(Date.now() + 86400000).toISOString(),
    eventType: "team",
    images: ["https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1740&auto=format&fit=crop"],
    isFeatured: true,
    isPublic: true,
    links: [],
    minTeamSize: 2,
    maxTeamSize: 4,
    paymentRequired: false,
    paymentStarted: false,
    prizes: "1st Prize: $1000",
    shortPrizes: "$1000",
    reelsId: [],
    registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
    registrationFee: {
      host: 0,
      other: 100
    },
    rules: "No plagiarism.",
    sameCollegeOnly: false,
    venueName: "Main Auditorium"
  },
  {
    eventId: "mock_event_2",
    title: "Cultural Night",
    description: "Enjoy a night full of music, dance, and drama.",
    shortDescription: "Music, dance, and drama.",
    category: "Cultural",
    coordinators: [
      {
        email: "coord2@example.com",
        name: "Bob",
        phone: "0987654321",
        userID: "user_2"
      }
    ],
    coverImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1740&auto=format&fit=crop",
    customFields: [],
    dateTime: new Date(Date.now() + 86400000 * 3).toISOString(),
    endDateTime: new Date(Date.now() + 86400000 * 4).toISOString(),
    startDateTime: new Date(Date.now() + 86400000 * 3).toISOString(),
    eventType: "individual",
    images: ["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1740&auto=format&fit=crop"],
    isFeatured: true,
    isPublic: true,
    links: [],
    paymentRequired: true,
    paymentStarted: true,
    prizes: "Certificate",
    shortPrizes: "Certificate",
    reelsId: [],
    registrationDeadline: new Date(Date.now() + 86400000 * 2).toISOString(),
    registrationFee: {
      host: 50,
      other: 150
    },
    rules: "Bring your own props.",
    sameCollegeOnly: false,
    venueName: "Open Air Theatre"
  },
  {
    eventId: "mock_event_3",
    title: "Startup Pitch",
    description: "Pitch your startup idea to top investors.",
    shortDescription: "Pitch your startup idea.",
    category: "Business",
    coordinators: [
      {
        email: "coord3@example.com",
        name: "Charlie",
        phone: "1122334455",
        userID: "user_3"
      }
    ],
    coverImage: "https://images.unsplash.com/photo-1556761175-5973dc0f32b7?q=80&w=1632&auto=format&fit=crop",
    customFields: [],
    dateTime: new Date(Date.now() + 86400000 * 5).toISOString(),
    endDateTime: new Date(Date.now() + 86400000 * 6).toISOString(),
    startDateTime: new Date(Date.now() + 86400000 * 5).toISOString(),
    eventType: "team",
    images: ["https://images.unsplash.com/photo-1556761175-5973dc0f32b7?q=80&w=1632&auto=format&fit=crop"],
    isFeatured: false,
    isPublic: true,
    links: [],
    minTeamSize: 1,
    maxTeamSize: 3,
    paymentRequired: false,
    paymentStarted: false,
    prizes: "Seed Funding",
    shortPrizes: "Seed Funding",
    reelsId: [],
    registrationDeadline: new Date(Date.now() + 86400000 * 4).toISOString(),
    registrationFee: {
      host: 0,
      other: 0
    },
    rules: "5 minutes presentation max.",
    sameCollegeOnly: false,
    venueName: "Conference Hall A"
  }
];
