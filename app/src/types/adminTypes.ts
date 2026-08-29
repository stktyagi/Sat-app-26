// src/types/adminTypes.ts
export interface UserFilters {
  searchTerm: string;
  campusFilter: "all" | "host" | "external" | string; // string for specific college names
  ambassadorFilter: "all" | "ambassadors" | "non-ambassadors";
}

export interface UserStats {
  totalUsers: number;
  ambassadors: number;
  hostCollegeUsers: number;
  externalUsers: number;
  verifiedUsers: number;
}

// Transaction/Payment Types
export interface CouponDetails {
  code: string;
  discountType: string;
  discountValue: number;
}

export interface EventRegistration {
  amount: number;
  eventId: string;
  eventType: string;
  teamId: string;
  teamName: string;
}

export interface ProcessedIntentions {
  accommodation: any | null;
  eventRegistration: EventRegistration | null;
  food: any | null;
}

export interface PaymentTransaction {
  id: string; // Document ID (merchantOrderId)
  completedAt: string;
  couponCode?: string;
  couponDetails?: CouponDetails;
  createdAt: string;
  discountAmount: number;
  eventId: string;
  finalAmount: number;
  merchantOrderId: string;
  originalAmount: number;
  paymentType: string;
  processedIntentions: ProcessedIntentions;
  status: string;
  teamId?: string;
  transactionFees: number;
  userId: string;
}

export interface TransactionFilters {
  searchTerm: string;
  statusFilter: "all" | "success" | "failed" | "pending";
  paymentTypeFilter: "all" | "event" | "accommodation" | "food";
  dateRange: "all" | "today" | "week" | "month";
}

export interface AdminUserProfile {
  userId: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  collegeName: string;
  isHostCollegeStudent: boolean;
  isAmbassador: boolean;
  isVerified: boolean;
  coins: number;
  points?: number;
  createdAt: string;
  accommodationNeeded: boolean;
  fullyRegistered: boolean;
  role: string;
  roles?: string[]; // Array of roles for the new role system
  // Extended fields from UserProfile
  collegeState?: string;
  graduationYear?: string;
  rollNumber?: string;
  gender?: 'male' | 'female' | 'other';
  accommodation?: {
    day0?: boolean;
    day00?: boolean;
    day1?: boolean;
    day2?: boolean;
    day3?: boolean;
    day4?: boolean;
  };
  referralCode?: string;
  referredBy?: string;
  sessionToken?: string;
}
