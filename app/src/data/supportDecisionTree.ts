/**
 * supportDecisionTree.ts
 *
 * Structured, data-driven decision tree for the Saturnalia'26 Help & Support system.
 * Derived from actual application business logic:
 * - Easebuzz payments & Webhook reconciliation
 * - Event registrations (host vs non-host rules, team codes, credit-based roster limits)
 * - Accommodation & hostel allocations (mandatory before food, day0..day4 check-in)
 * - Dining pass verification (food:all and food:dayX mess QR verification)
 * - Campus venues, Mapbox navigation, and gate check-in
 * - Identity verification rules (@thapar.edu exemption, live camera capture)
 */

export type NodeType = 'category' | 'question' | 'resolution' | 'contact';

export interface CoordinatorContact {
  id: string;
  name: string;
  phone: string;
  role?: string;
  department?: string;
  email?: string;
  location?: string;
  availableHours?: string;
}

export interface MealTimeSlot {
  name: string;
  time: string;
  icon: string;
}

export interface MealScheduleGroup {
  dayLabel: string;
  slots: MealTimeSlot[];
}

export interface ResolutionContent {
  title: string;
  description: string;
  steps: string[];
  notes?: string[];
  warning?: string;
  actionText?: string;
  actionRoute?: string;
  escalationNodeId?: string; // Optional escalation if self-service fails
  mealSchedule?: MealScheduleGroup[];
}

export interface ContactContent {
  title: string;
  reason: string;
  coordinatorId?: string;
  coordinatorIds?: string[];
  urgency?: 'high' | 'normal';
  suggestedInfoToShare?: string[];
}

export interface SupportOption {
  id: string;
  label: string;
  description?: string;
  targetNodeId: string;
  icon?: string;
}

export interface SupportNode {
  id: string;
  type: NodeType;
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  options?: SupportOption[];
  resolution?: ResolutionContent;
  contact?: ContactContent;
  keywords?: string[]; // For quick search matching
}

export interface SupportCategory {
  id: string;
  title: string;
  shortDesc: string;
  icon: string;
  badge?: string;
  rootNodeId: string;
  keywords: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Official Fest Coordinators Directory (Configurable in one single place)
// ─────────────────────────────────────────────────────────────────────────────

export const FEST_COORDINATORS: Record<string, CoordinatorContact> = {
  sivansh: {
    id: 'sivansh',
    name: 'Sivansh Satpathy',
    phone: '+91 87796 87009',
  },
  aniket: {
    id: 'aniket',
    name: 'Aniket Gupta',
    phone: '+91 93507 16440',
  },
  aarush: {
    id: 'aarush',
    name: 'Aarush',
    phone: '+91 98769 72101',
  },
  aadil: {
    id: 'aadil',
    name: 'Aadil',
    phone: '+91 98721 00693',
  },
  rakshit: {
    id: 'rakshit',
    name: 'Rakshit Dhamija',
    phone: '+91 95013 49322',
  },
};

// ──// ─────────────────────────────────────────────────────────────────────────────
// Main Support Categories
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: 'payments',
    title: 'Payments & Fees',
    shortDesc: 'Bank deductions, payment status, and fee queries',
    icon: 'card-outline',
    rootNodeId: 'node_pay_root',
    keywords: ['payment', 'failed', 'deducted', 'refund', 'money', 'upgrade'],
  },
  {
    id: 'events_venues',
    title: 'Events & Venues',
    shortDesc: 'Registrations, team codes, stages, and campus locations',
    icon: 'trophy-outline',
    rootNodeId: 'node_ev_venues_root',
    keywords: ['event', 'register', 'team', 'invite', 'code', 'competition', 'venue', 'map', 'stage', 'audi', 'oat'],
  },
  {
    id: 'accommodation',
    title: 'Hostel & Stay',
    shortDesc: 'Room allotment, night check-in, mess timings, and facilities',
    icon: 'bed-outline',
    rootNodeId: 'node_acc_root',
    keywords: ['hostel', 'room', 'stay', 'accommodation', 'bed', 'check-in', 'curfew', 'mess', 'food', 'timing', 'lunch', 'dinner', 'breakfast'],
  },
  {
    id: 'technical',
    title: 'App Bugs & Account',
    shortDesc: 'Crashes, push notifications, and profile details',
    icon: 'bug-outline',
    rootNodeId: 'node_tech_root',
    keywords: ['crash', 'bug', 'notification', 'login', 'logout', 'profile', 'phone', 'update'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Decision Tree Nodes
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORT_NODES: Record<string, SupportNode> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  node_pay_root: {
    id: 'node_pay_root',
    type: 'question',
    category: 'payments',
    title: 'Payment & Fee Inquiries',
    subtitle: 'What specific payment situation occurred?',
    options: [
      {
        id: 'opt_pay_deducted',
        label: 'Money deducted, but app shows Pending / Failed',
        description: 'Amount left your bank account, but registration is not confirmed',
        targetNodeId: 'node_pay_txnid_q',
        icon: 'cash-outline',
      },
      {
        id: 'opt_pay_gateway_err',
        label: 'Payment page fails to load or gives an error',
        description: 'Payment screen does not load or closes unexpectedly',
        targetNodeId: 'node_pay_gateway_q',
        icon: 'alert-circle-outline',
      },
      {
        id: 'opt_pay_upgrade',
        label: 'Why am I seeing an "Accommodation Upgrade Fee"?',
        description: 'Explanation for accommodation charges on technical events',
        targetNodeId: 'node_pay_upgrade_res',
        icon: 'information-circle-outline',
      },
      {
        id: 'opt_pay_duplicate',
        label: 'Charged twice for the same event or booking',
        description: 'Duplicate debits on your bank card or UPI app',
        targetNodeId: 'node_pay_duplicate_contact',
        icon: 'copy-outline',
      },
    ],
  },

  node_pay_txnid_q: {
    id: 'node_pay_txnid_q',
    type: 'question',
    category: 'payments',
    title: 'Transaction Details',
    subtitle: 'Do you have the bank reference number or transaction ID?',
    options: [
      {
        id: 'opt_pay_has_txnid',
        label: 'Yes, I have the transaction ID or bank reference',
        description: 'From your bank SMS, UPI app, or payment receipt',
        targetNodeId: 'node_pay_sync_res',
        icon: 'receipt-outline',
      },
      {
        id: 'opt_pay_no_txnid',
        label: 'No transaction ID was shown, but money was deducted',
        description: 'The payment closed before showing a confirmation message',
        targetNodeId: 'node_pay_bank_drop_res',
        icon: 'help-circle-outline',
      },
    ],
  },

  node_pay_sync_res: {
    id: 'node_pay_sync_res',
    type: 'resolution',
    category: 'payments',
    title: 'Payment Confirmation Help',
    resolution: {
      title: 'Waiting for Bank Confirmation',
      description: 'During busy festival hours, banks can sometimes take 5 to 15 minutes to confirm a payment to our system.',
      steps: [
        'Do not make another payment right away to avoid duplicate charges.',
        'Navigate to Profile > My Registered Events and pull down the screen to refresh your live status.',
        'Once your bank confirms the transaction, your status will change from Pending to Confirmed.',
        'If 15 minutes have passed and your registration is still not confirmed, contact the coordinator with your payment screenshot.',
      ],
      notes: [
        'Keep your bank debit SMS or UPI payment screenshot handy.',
      ],
      warning: 'Never share your UPI PIN, password, or OTP with anyone. Fest coordinators will never ask for your PIN.',
      escalationNodeId: 'node_pay_reconcile_contact',
    },
  },

  node_pay_bank_drop_res: {
    id: 'node_pay_bank_drop_res',
    type: 'resolution',
    category: 'payments',
    title: 'Payment Deducted but Registration Not Created',
    resolution: {
      title: 'Automatic Bank Refund',
      description: 'When an online payment is interrupted before finishing, the money stays with your bank and will be returned to you.',
      steps: [
        'Banks automatically refund failed payments back to your account within 3 to 5 working days.',
        'Check your bank statement or UPI app after 24 hours to see if the refund has arrived.',
        'You can safely try registering again in the app using UPI, card, or net banking.',
      ],
      notes: [
        'If the money is not returned after 5 days, contact your bank with the transaction reference number (UTR).',
      ],
      escalationNodeId: 'node_pay_reconcile_contact',
    },
  },

  node_pay_gateway_q: {
    id: 'node_pay_gateway_q',
    type: 'question',
    category: 'payments',
    title: 'Checkout Gateway Issues',
    subtitle: 'What error occurred during checkout?',
    options: [
      {
        id: 'opt_pay_gw_white',
        label: 'Blank screen or infinite spinner',
        description: 'The payment screen did not open or froze',
        targetNodeId: 'node_pay_gw_white_res',
        icon: 'globe-outline',
      },
      {
        id: 'opt_pay_gw_declined',
        label: 'Card or UPI payment declined',
        description: 'Bank rejected transaction or limit exceeded',
        targetNodeId: 'node_pay_gw_declined_res',
        icon: 'close-circle-outline',
      },
    ],
  },

  node_pay_gw_white_res: {
    id: 'node_pay_gw_white_res',
    type: 'resolution',
    category: 'payments',
    title: 'Payment Screen Not Loading',
    resolution: {
      title: 'Fixing Screen Loading Issues',
      description: 'If the payment screen stays blank or gets stuck while opening, try these quick steps:',
      steps: [
        'Turn off any active VPN apps on your phone.',
        'Switch between Wi-Fi and mobile data if your network is slow.',
        'Ensure your device date and time settings are set to Automatic.',
        'Close and restart the Saturnalia app, then retry checkout.',
      ],
      warning: 'If you are on campus Wi-Fi, bank payment pages can sometimes be blocked by university filters. Try switching to mobile data.',
    },
  },

  node_pay_gw_declined_res: {
    id: 'node_pay_gw_declined_res',
    type: 'resolution',
    category: 'payments',
    title: 'Bank Decline Solutions',
    resolution: {
      title: 'Alternative Payment Methods',
      description: 'Card or UPI rejections typically occur due to online e-commerce transaction limits or bank server downtime.',
      steps: [
        'Enable online/e-commerce transactions on your debit or credit card via your banking app.',
        'Try paying directly using Google Pay, PhonePe, or Paytm UPI handle.',
        'Ensure your daily UPI transfer limit has not been exhausted.',
      ],
      escalationNodeId: 'node_pay_reconcile_contact',
    },
  },

  node_pay_upgrade_res: {
    id: 'node_pay_upgrade_res',
    type: 'resolution',
    category: 'payments',
    title: 'Accommodation Upgrade Rules',
    resolution: {
      title: 'Fest Accommodation Logistics Rule',
      description: 'Saturnalia provides subsidized festival accommodation. Cultural and Technical events have separate logistics allocations.',
      steps: [
        'Participants with Cultural accommodation (₹650/day) who later register for a Technical event must pay the technical upgrade differential.',
        'The differential covers access to specialized technical workshops, labs, and 24-hour hackathon logistics.',
        'If you already paid the full technical tier, no additional fee is charged.',
      ],
      notes: [
        'You can verify your current accommodation tier in Profile > Accommodation.',
      ],
    },
  },

  node_pay_duplicate_contact: {
    id: 'node_pay_duplicate_contact',
    type: 'contact',
    category: 'payments',
    title: 'Duplicate Payment',
    contact: {
      title: 'Payment Verification',
      reason: 'Contact to verify your extra payment and initiate a refund.',
      coordinatorId: 'rakshit',
      coordinatorIds: ['rakshit'],
    },
  },

  node_pay_reconcile_contact: {
    id: 'node_pay_reconcile_contact',
    type: 'contact',
    category: 'payments',
    title: 'Payment Support',
    contact: {
      title: 'Payment Verification',
      reason: 'Contact to verify your payment status and confirm your registration.',
      coordinatorId: 'rakshit',
      coordinatorIds: ['rakshit'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EVENT REGISTRATIONS & TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  node_ev_venues_root: {
    id: 'node_ev_venues_root',
    type: 'question',
    category: 'events_venues',
    title: 'Events & Venues Help',
    subtitle: 'What do you need assistance with?',
    options: [
      {
        id: 'opt_ev_team_code',
        label: 'Team issues (Invite codes, joining, team size)',
        description: 'Teammates cannot join or team status is pending',
        targetNodeId: 'node_ev_team_q',
        icon: 'people-outline',
      },
      {
        id: 'opt_ev_reg_blocked',
        label: 'Registration button is disabled or gives an error',
        description: 'Unable to tap register or getting an error alert',
        targetNodeId: 'node_ev_blocked_q',
        icon: 'lock-closed-outline',
      },
      {
        id: 'opt_ven_find_stage',
        label: 'Locating Main Stage, Audi, or Amphitheatre',
        description: 'Directions to major festival stages and venues',
        targetNodeId: 'node_ven_map_res',
        icon: 'navigate-outline',
      },
      {
        id: 'opt_ven_changed',
        label: 'Did an event venue or timing change?',
        description: 'Checking live rescheduling notices and announcements',
        targetNodeId: 'node_ven_reschedule_res',
        icon: 'time-outline',
      },
      {
        id: 'opt_ev_fee_calc',
        label: 'How event fees are calculated',
        description: 'Explanation for individual vs team fee rules',
        targetNodeId: 'node_ev_team_fee_res',
        icon: 'calculator-outline',
      },
      {
        id: 'opt_ev_modify',
        label: 'Need to modify roster or contact coordinator',
        description: 'Roster changes after registration confirmation',
        targetNodeId: 'node_ev_modify_contact',
        icon: 'call-outline',
      },
    ],
  },

  node_ev_blocked_q: {
    id: 'node_ev_blocked_q',
    type: 'question',
    category: 'events_venues',
    title: 'Registration Block Reasons',
    subtitle: 'What does the message say when attempting to register?',
    options: [
      {
        id: 'opt_ev_profile_missing',
        label: 'Incomplete profile details',
        description: 'Phone number or profile details need updating',
        targetNodeId: 'node_ev_profile_res',
        icon: 'person-outline',
      },
      {
        id: 'opt_ev_quota_full',
        label: '"Registration Closed" or "Max Capacity Reached"',
        description: 'The competition has reached maximum allowed entries',
        targetNodeId: 'node_ev_closed_res',
        icon: 'alert-circle-outline',
      },
      {
        id: 'opt_ev_already_reg',
        label: '"Already Registered" or conflict alert',
        description: 'You or a teammate are already in a team for this event',
        targetNodeId: 'node_ev_conflict_res',
        icon: 'information-circle-outline',
      },
    ],
  },

  node_ev_profile_res: {
    id: 'node_ev_profile_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Profile Details Required',
    resolution: {
      title: 'Complete Profile Details',
      description: 'Please ensure your phone number and profile information are filled in before registering for events.',
      steps: [
        'Go to the Profile tab in the bottom navigation.',
        'Tap Edit Profile near your profile card.',
        'Enter your 10-digit mobile number and save changes.',
        'Return to the event and tap Register again.',
      ],
    },
  },

  node_ev_closed_res: {
    id: 'node_ev_closed_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Event Capacity & Waitlists',
    resolution: {
      title: 'Event Registration Cap Reached',
      description: 'Certain flagship events (Robowars, Battle of Bands, Hackathon) have hard venue caps enforced by competition judges.',
      steps: [
        'Check if other tracks or companion competitions in the same category are still open.',
        'Visit the Events team at the Main Auditorium to check if any confirmed teams forfeit their spot for on-spot waitlist entry.',
      ],
      escalationNodeId: 'node_ev_modify_contact',
    },
  },

  node_ev_conflict_res: {
    id: 'node_ev_conflict_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Team Conflict Resolution',
    resolution: {
      title: 'Single-Entry Policy',
      description: 'Each participant can only be part of one registered team per event to prevent scheduling and judging conflicts.',
      steps: [
        'If you created a dummy or preliminary team earlier, have the leader delete it or leave the team from your event page.',
        'Ensure none of your teammates have registered individually or joined another team for this competition.',
      ],
    },
  },

  node_ev_team_q: {
    id: 'node_ev_team_q',
    type: 'question',
    category: 'events_venues',
    title: 'Team Roster & Codes',
    subtitle: 'What specific team issue are you experiencing?',
    options: [
      {
        id: 'opt_ev_invite_code',
        label: 'Teammates get "Invalid Invite Code"',
        description: '6-character code is not recognized by app',
        targetNodeId: 'node_ev_invite_res',
        icon: 'key-outline',
      },
      {
        id: 'opt_ev_min_size',
        label: 'Team shows "Incomplete" or cannot confirm',
        description: 'Minimum team size requirement not met',
        targetNodeId: 'node_ev_min_res',
        icon: 'people-circle-outline',
      },
    ],
  },

  node_ev_invite_res: {
    id: 'node_ev_invite_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Team Invite Code Guide',
    resolution: {
      title: 'Joining an Existing Team',
      description: 'Team invite codes are case-sensitive 6-character alphanumeric identifiers generated by the team leader upon creation.',
      steps: [
        'Ask the team leader to open the event in the app and copy the exact Invite Code.',
        'The joining teammate must open the same event, tap "Join Existing Team", and paste the code.',
        'Ensure the joining teammate has completed their profile details (phone number and gender).',
      ],
      notes: [
        'Invite codes become invalid once the maximum team roster limit is reached.',
      ],
      escalationNodeId: 'node_ev_modify_contact',
    },
  },

  node_ev_min_res: {
    id: 'node_ev_min_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Minimum Team Roster Requirement',
    resolution: {
      title: 'Team Size Validation',
      description: 'Competitions specify minimum and maximum roster sizes (e.g. 3 to 5 participants). Teams below the minimum size cannot compete.',
      steps: [
        'Check the event rules card for the minimum required team members.',
        'Share your invite code with additional teammates until the minimum quota is filled.',
        'Once the roster criteria are met, your team registration automatically transitions to Confirmed.',
      ],
    },
  },

  node_ev_team_fee_res: {
    id: 'node_ev_team_fee_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Team Pricing Rules & Settlement Credits',
    resolution: {
      title: 'How Team Fees Are Calculated',
      description: 'The app dynamically calculates team fees based on event payment type:',
      steps: [
        'Per Individual Events: Each roster member pays their individual fee (Host vs Non-Host rate).',
        'Flat Team Events: A single flat entry fee covers the entire team regardless of roster size.',
        'Credit Deduction: If the leader or any member previously paid an installment, the system credits that amount (paidTill) and only charges the remaining balance.',
      ],
      notes: [
        'Host college students (@thapar.edu) receive subsidized pricing automatically.',
      ],
    },
  },

  node_ev_modify_contact: {
    id: 'node_ev_modify_contact',
    type: 'contact',
    category: 'events_venues',
    title: 'Event Coordinator Support',
    contact: {
      title: 'Events Team',
      reason: 'Contact for roster changes, event queries, or team issues.',
      coordinatorId: 'sivansh',
      coordinatorIds: ['sivansh', 'aniket'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. ACCOMMODATION & HOSTEL STAY
  // ═══════════════════════════════════════════════════════════════════════════
  node_acc_root: {
    id: 'node_acc_root',
    type: 'question',
    category: 'accommodation',
    title: 'Hostel & Stay Assistance',
    subtitle: 'What issue do you need help with regarding accommodation?',
    options: [
      {
        id: 'opt_acc_mess_timings',
        label: 'Mess timing, location, or menu queries',
        description: 'Where and when breakfast, lunch, and dinner are served',
        targetNodeId: 'node_acc_mess_res',
        icon: 'restaurant-outline',
      },
      {
        id: 'opt_acc_room_allot',
        label: 'No hostel room allotted yet',
        description: 'Booked accommodation but hostel name is blank in app',
        targetNodeId: 'node_acc_room_res',
        icon: 'home-outline',
      },
      {
        id: 'opt_acc_checkin_issue',
        label: 'Problems with gate check-in or late arrival',
        description: 'Night curfew, arrival after hours, or guard issues',
        targetNodeId: 'node_acc_checkin_q',
        icon: 'time-outline',
      },
      {
        id: 'opt_acc_booking_req',
        label: 'Cannot book accommodation in app',
        description: 'Error when selecting days or paying for stay',
        targetNodeId: 'node_acc_req_res',
        icon: 'alert-circle-outline',
      },
      {
        id: 'opt_acc_room_cond',
        label: 'Room facilities issue (Cleanliness, fan, mattress)',
        description: 'Issues with physical hostel amenities',
        targetNodeId: 'node_acc_facility_contact',
        icon: 'bed-outline',
      },
    ],
  },

  node_acc_mess_res: {
    id: 'node_acc_mess_res',
    type: 'resolution',
    category: 'accommodation',
    title: 'Mess Timings & Locations',
    resolution: {
      title: 'Hostel Mess Timings',
      description: 'Meals are served in your respective hostels allotted.',
      steps: [
        'Breakfast : 7:00 AM – 9:00 AM',
        'Lunch : 12:00 PM – 2:00 PM',
        'Dinner : 7:00 PM – 9:00 PM',
        'On weekends:',
        'Breakfast : 7:30 AM – 9:30 AM',
        'Lunch : 12:30 PM – 2:30 PM',
        'Dinner : 7:00 PM – 9:00 PM',
      ],
      mealSchedule: [
        {
          dayLabel: 'Regular Days',
          slots: [
            { name: 'Breakfast', time: '7:00 AM – 9:00 AM', icon: 'sunny-outline' },
            { name: 'Lunch', time: '12:00 PM – 2:00 PM', icon: 'restaurant-outline' },
            { name: 'Dinner', time: '7:00 PM – 9:00 PM', icon: 'moon-outline' },
          ],
        },
        {
          dayLabel: 'On weekends',
          slots: [
            { name: 'Breakfast', time: '7:30 AM – 9:30 AM', icon: 'sunny-outline' },
            { name: 'Lunch', time: '12:30 PM – 2:30 PM', icon: 'restaurant-outline' },
            { name: 'Dinner', time: '7:00 PM – 9:00 PM', icon: 'moon-outline' },
          ],
        },
      ],
    },
  },

  node_acc_room_res: {
    id: 'node_acc_room_res',
    type: 'resolution',
    category: 'accommodation',
    title: 'Hostel Room Allotment Process',
    resolution: {
      title: 'On-Arrival Room Allocation',
      description: 'Hostel rooms (e.g. Vyan Hall / Hostel H, Vasudha Hall / Hostel E) are dynamically allocated when you physically check in on campus.',
      steps: [
        'Your online booking secures your bed for the selected festival days (day0 to day4).',
        'Upon reaching campus, proceed to the Hospitality team at the Main Gate.',
        'Show your digital accommodation pass from Profile > Accommodation.',
        'The coordinator will scan your gate pass, verify your ID, and allocate your specific room and bed key.',
      ],
      warning: 'Do not go directly to the hostels before reporting to the Main Hospitality team.',
      escalationNodeId: 'node_acc_desk_contact',
    },
  },

  node_acc_checkin_q: {
    id: 'node_acc_checkin_q',
    type: 'question',
    category: 'accommodation',
    title: 'Arrival & Curfew Check-In',
    subtitle: 'What is your check-in situation?',
    options: [
      {
        id: 'opt_acc_late_arrival',
        label: 'Arriving late at night (after 10:00 PM)',
        description: 'Need late-night entry clearance and room access',
        targetNodeId: 'node_acc_night_res',
        icon: 'moon-outline',
      },
      {
        id: 'opt_acc_guard_refusal',
        label: 'Hostel guard says I am not in the check-in list',
        description: 'App shows booked but guard cannot verify',
        targetNodeId: 'node_acc_guard_contact',
        icon: 'shield-outline',
      },
    ],
  },

  node_acc_night_res: {
    id: 'node_acc_night_res',
    type: 'resolution',
    category: 'accommodation',
    title: 'Late Night Arrival Protocol',
    resolution: {
      title: '24-Hour Hospitality Support',
      description: 'The Saturnalia Hospitality Team operates around the clock at Main Gate 1 for outstation participants arriving on night trains or buses.',
      steps: [
        'Report directly to Security Gate 1; inform security that you are a Saturnalia fest participant.',
        'Show your confirmed accommodation pass on the app.',
        'The Night Hospitality volunteer on duty will escort you to your allotted hostel block.',
      ],
      notes: [
        'If the gate is locked, call the 24x7 Hospitality Helpline below.',
      ],
      escalationNodeId: 'node_acc_desk_contact',
    },
  },

  node_acc_req_res: {
    id: 'node_acc_req_res',
    type: 'resolution',
    category: 'accommodation',
    title: 'Accommodation Eligibility Rule',
    resolution: {
      title: 'Event Participation Prerequisite',
      description: 'Under Thapar University campus festival guidelines, hostel accommodation is strictly reserved for registered event participants.',
      steps: [
        'You must register for at least one competition or workshop before accommodation booking unlocks.',
        'Browse the Events tab and complete registration for any event.',
        'Once registered, return to Profile > Accommodation to select your stay and food dates.',
      ],
      notes: [
        'Accommodation can be booked for any combination of days (Day 0 through Day 4).',
      ],
    },
  },

  node_acc_guard_contact: {
    id: 'node_acc_guard_contact',
    type: 'contact',
    category: 'accommodation',
    title: 'Hostel Check-in Support',
    contact: {
      title: 'Hospitality Team',
      reason: 'Contact to verify your allotment with hostel security.',
      coordinatorId: 'aarush',
      coordinatorIds: ['aarush', 'aadil'],
    },
  },

  node_acc_facility_contact: {
    id: 'node_acc_facility_contact',
    type: 'contact',
    category: 'accommodation',
    title: 'Hostel Amenities Assistance',
    contact: {
      title: 'Hospitality Team',
      reason: 'To request mattress replacement, room cleaning, or report room issues.',
      coordinatorId: 'aarush',
      coordinatorIds: ['aarush', 'aadil'],
    },
  },

  node_acc_desk_contact: {
    id: 'node_acc_desk_contact',
    type: 'contact',
    category: 'accommodation',
    title: 'Hospitality Support',
    contact: {
      title: 'Hospitality Team',
      reason: 'Contact for room allocations, check-in issues, and night clearances.',
      coordinatorId: 'aarush',
      coordinatorIds: ['aarush', 'aadil'],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. CAMPUS VENUES & NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════


  node_ven_map_res: {
    id: 'node_ven_map_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Using the Interactive Campus Map',
    resolution: {
      title: 'Live Campus Wayfinding',
      description: 'The app features an interactive 3D vector map of the entire Thapar University campus with GPS location pins.',
      steps: [
        'Tap the Map icon on the main screen header or navigate to the Map view.',
        'Use the top search bar to search for any stage (e.g. "Main Audi", "Amphitheatre", "OAT", "TAN Audi").',
        'Tap the venue pin to view exact latitude/longitude, walking distance, and events currently taking place there.',
      ],
      notes: [
        'Enable GPS Location permissions for live "You are here" blue-dot tracking.',
      ],
    },
  },

  node_ven_reschedule_res: {
    id: 'node_ven_reschedule_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Live Event Rescheduling',
    resolution: {
      title: 'Real-Time Schedule Sync',
      description: 'Event timings and locations are managed live by the Events Executive Board.',
      steps: [
        'Open the Events tab and pull down to fetch the latest schedule.',
        'Check the Notifications bell icon in the top header for broadcast alerts regarding weather shifts or venue swaps.',
        'Visit the Events team at the Main Auditorium foyer for physical notices.',
      ],
      escalationNodeId: 'node_ev_modify_contact',
    },
  },

  node_ven_map_bug_res: {
    id: 'node_ven_map_bug_res',
    type: 'resolution',
    category: 'events_venues',
    title: 'Mapbox Display Troubleshooting',
    resolution: {
      title: 'Restoring Map Functionality',
      description: 'If map tiles fail to load:',
      steps: [
        'Ensure you have an active internet connection to download campus vector tiles.',
        'Close the app completely from your phone recent apps switcher and reopen.',
        'If maps remain unavailable, all major venue names and event locations are also listed in text format inside each event details card.',
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. APP BUGS & TECHNICAL ISSUES
  // ═══════════════════════════════════════════════════════════════════════════
  node_tech_root: {
    id: 'node_tech_root',
    type: 'question',
    category: 'technical',
    title: 'Technical & App Support',
    subtitle: 'What technical issue are you encountering?',
    options: [
      {
        id: 'opt_tech_notif',
        label: 'Not receiving announcements or push notifications',
        description: 'Missing event announcements or schedule reminders',
        targetNodeId: 'node_tech_notif_res',
        icon: 'notifications-outline',
      },
      {
        id: 'opt_tech_crash',
        label: 'App crashes or freezes repeatedly',
        description: 'Unexpected closures or memory issues',
        targetNodeId: 'node_tech_crash_res',
        icon: 'warning-outline',
      },
      {
        id: 'opt_tech_contact_dev',
        label: 'Report a critical security flaw or software bug',
        description: 'Direct line to Saturnalia app engineering team',
        targetNodeId: 'node_tech_contact',
        icon: 'code-slash-outline',
      },
    ],
  },

  node_tech_notif_res: {
    id: 'node_tech_notif_res',
    type: 'resolution',
    category: 'technical',
    title: 'Restoring Push Notifications',
    resolution: {
      title: 'Notification Settings & Battery Optimization',
      description: 'Make sure notifications are enabled so you receive live updates and event announcements.',
      steps: [
        'Ensure notifications are allowed in Android/iOS system settings for the Saturnalia app.',
        'Disable "Battery Saver" or aggressive background app killing for Saturnalia.',
        'Open the app with a working internet connection so notification permissions can update.',
      ],
    },
  },

  node_tech_crash_res: {
    id: 'node_tech_crash_res',
    type: 'resolution',
    category: 'technical',
    title: 'App Stability & Cache Clearing',
    resolution: {
      title: 'Restoring App Stability',
      description: 'Temporary files after an update can sometimes cause the app to slow down or freeze.',
      steps: [
        'Check for the latest version in Profile > Check for Updates.',
        'On Android, go to phone Settings > Apps > Saturnalia > Storage and tap Clear Cache.',
        'Restart your phone and open the app.',
      ],
      escalationNodeId: 'node_tech_contact',
    },
  },

  node_tech_contact: {
    id: 'node_tech_contact',
    type: 'contact',
    category: 'technical',
    title: 'App Support',
    contact: {
      title: 'Technical Team',
      reason: 'For software bugs, login issues, or app crashes.',
      coordinatorId: 'rakshit',
      coordinatorIds: ['rakshit'],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Search helper: matches user queries across categories and issue nodes
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchResultItem {
  nodeId: string;
  category: string;
  title: string;
  snippet: string;
  type: NodeType;
}

export function searchSupportTree(query: string): SearchResultItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  const results: SearchResultItem[] = [];

  for (const node of Object.values(SUPPORT_NODES)) {
    let score = 0;
    const titleLower = node.title.toLowerCase();
    const subLower = (node.subtitle || '').toLowerCase();
    const descLower = (node.description || '').toLowerCase();

    if (titleLower.includes(clean)) score += 10;
    if (subLower.includes(clean)) score += 5;
    if (descLower.includes(clean)) score += 3;

    if (node.keywords?.some((k) => k.toLowerCase().includes(clean) || clean.includes(k.toLowerCase()))) {
      score += 7;
    }

    // Also check options
    if (node.options) {
      for (const opt of node.options) {
        if (opt.label.toLowerCase().includes(clean)) score += 5;
        if (opt.description?.toLowerCase().includes(clean)) score += 3;
      }
    }

    if (score > 0) {
      results.push({
        nodeId: node.id,
        category: node.category,
        title: node.title,
        snippet: node.subtitle || node.description || (node.options?.[0]?.label ?? ''),
        type: node.type,
      });
    }
  }

  return results.slice(0, 10);
}
