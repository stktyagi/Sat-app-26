// export type UserProfile = {
//   userId: string; // From Firebase Auth (uid)
//   email: string;
//   displayName: string;
//   photoURL?: string;
//   isHostCollegeStudent: boolean;
//   collegeIdNumber?: string;
//   externalCollegeName?: string;
//   externalCollegeIdUrl?: string;
//   accommodationNeeded: boolean;
//   role: "user" | "eventManager" | "superAdmin";
//   referralCode: string;
//   referredBy?: string;
//   coins: number;
//   createdAt: Timestamp;
//   graduationYear: string;
//   collegeState: string;
// };

export interface AppUpdate {
  version: string;
  forceUpdate: boolean;
  updateUrl: string;
  releaseNotes?: string;
  minimumVersion?: string;
}

export interface EventFeedback {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string; // ISO string
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  phoneNumber: string;
  rollNumber: string;
  isHostCollegeStudent: boolean;
  collegeIdNumber?: string;
  collegeName: string;
  role: string;
  roles: string[]; // New roles array
  photoURL?: string;
  referralCode?: string; // blame hari for the incorret spelling
  referredBy?: string;
  createdAt: string;
  gender: 'male' | 'female' | 'other';
  sessionToken: string;
  accommodationNeeded: boolean;
  accommodation?: {
    day0?: boolean;
    day00?: boolean;
    day1?: boolean;
    day2?: boolean;
    day3?: boolean;
    day4?: boolean;
  };
  food?: {
    day0?: boolean;
    day00?: boolean;
    day1?: boolean;
    day2?: boolean;
    day3?: boolean;
    day4?: boolean;
  };
  fullyRegistered: boolean; // to check if the person has not only done Oauth but also filled his details.
  isAmbassador: boolean;
  coins: number;
  collegeState: string;
  graduationYear: string;
  points?: number;
  isVerified: boolean;
}

export type Event = {
  id: string;
  name: string;
  description: string;
  category: string;
  startTime: any;
  endTime: any;
  venue: string;
  maxParticipants: number;
  registeredParticipants: number;
  registrationFee: number;
  isTeamEvent: boolean;
  minTeamSize?: number;
  maxTeamSize?: number;
  rules: string[];
  prizes: string[];
  contactInfo: {
    name: string;
    phone: string;
    email: string;
  };
  isActive: boolean;
  createdAt: any;
};

export type Registration = {
  id: string;
  userId: string;
  eventId: string;
  teamId?: string;
  registrationDate: any;
  status: "registered" | "confirmed" | "cancelled";
  paymentStatus: "pending" | "completed" | "failed";
  accommodationRequested: boolean;
};

export type Team = {
  id: string;
  name: string;
  eventId: string;
  leaderId: string;
  members: string[]; // Array of user IDs
  maxMembers: number;
  isComplete: boolean;
  createdAt: any;
};

export type Corousal = {
  id: string;
  imageUrl: string;
  link: string | null;
  corousalType: number;
  isPublic: boolean;
  date: any;
};

export type Reward = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  coins: number;
  isExclusive: boolean;
  isPublic: boolean;
  itemLeft: number;
  offerCoins: number;
  originalValue: number;
  date: any;
};

export type Reel = {
  id: string;
  videoUrl: string;

  title: string;
  description: string;
  event: {
    id: string;
    name: string;
    description: string;
    isRegistrationOpen: boolean;
  };
  duration: number;
  createdAt: any;
};

// Firebase Event model that matches the backend structure
export interface FirebaseEvent {
  eventId: string;
  title: string;
  description: string;
  shortDescription: string;
  category: string;
  coordinators: Array<{
    email: string;
    name: string;
    phone: string;
    userID: string;
  }>;
  coverImage: string;
  customFields: any[];
  dateTime: string;
  endDateTime: string;
  startDateTime: string;
  eventType: 'team' | 'individual' | 'externalLink';
  externalUrl?: string;
  images: string[];
  isFeatured: boolean;
  isPublic: boolean;
  links: string[];
  maxTeamSize?: number;
  minTeamSize?: number;
  paymentRequired: boolean;
  paymentStarted: boolean;
  prizes: string;
  shortPrizes: string;
  reelsId: string[];
  registrationDeadline: string;
  registrationFee: {
    host: number;
    other: number;
  };
  rules: string;
  sameCollegeOnly: boolean;
  venueId?: string;
  venueName?: string;
}

// Venue model for locations/venues
export interface Venue {
  venueId: string;
  venueName: string;
  lat: number;
  lng: number;
  longitude?: number;
  latitude?: number;
}


export interface Poll {
  id: string;
  question: string;
  description?: string;
  options: string[];
  votes: Record<string, number>;
  voters: string[]; // For large scale, consider subcollection
  createdBy: string;
  createdAt: any;
  isActive: boolean;
}

export interface Update {
  id: string;
  title: string;
  description: string;
  linkType?: 'event' | 'external'; // Type of link
  link?: string; // External URL
  eventId?: string; // Event ID if linkType is 'event'
  eventName?: string; // Event name for display
  createdAt: any;
}

export interface FAQ {
  faqId: string;
  question: string;
  answer: string;
  order: number;
  isPublic: boolean;
  createdAt: any;
}
