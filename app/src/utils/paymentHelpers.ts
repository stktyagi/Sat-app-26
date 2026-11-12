import type { AppAccommodation } from "@/api/appConfig";

export interface StayDayPrices {
  accDays: Record<string, number>;
  foodDays: Record<string, number>;
}

export const FESTIVAL_DAY_KEYS = ["day0", "day1", "day2", "day3", "day4"];

/**
 * Authoritative check for host college eligibility across the application.
 * Only verified `@thapar.edu` email domains or backend-flagged `isHostCollegeStudent` qualify.
 * Never inspects arbitrary college name strings.
 */
export function isHostStudent(
  user?: { isHostCollegeStudent?: boolean; email?: string } | null
): boolean {
  if (!user) return false;
  if (user.isHostCollegeStudent === true) return true;
  if (typeof user.email === "string" && user.email.trim().toLowerCase().endsWith("@thapar.edu")) {
    return true;
  }
  return false;
}

export function resolveStayPrices(
  doc: AppAccommodation | null | undefined,
  hasTechnical: boolean,
  hasCultural: boolean
): StayDayPrices {
  const defaultAcc = 650;
  const defaultFood = 150;

  const techPrice = doc?.technicalAmount ?? doc?.amount ?? defaultAcc;
  const cultPrice = doc?.culturalAmount ?? doc?.amount ?? defaultAcc;
  const techFoodPrice = doc?.technicalFoodAmount ?? doc?.foodAmount ?? defaultFood;
  const cultFoodPrice = doc?.culturalFoodAmount ?? doc?.foodAmount ?? defaultFood;
  const plainAcc = doc?.amount ?? defaultAcc;
  const plainFood = doc?.foodAmount ?? defaultFood;

  const accDays: Record<string, number> = {};
  const foodDays: Record<string, number> = {};

  for (const day of FESTIVAL_DAY_KEYS) {
    let tAcc = techPrice;
    let cAcc = cultPrice;
    let hasTAcc = false;
    let hasCAcc = false;

    if (doc?.technicalDays && typeof doc.technicalDays[day] === 'number' && doc.technicalDays[day] > 0) {
      tAcc = doc.technicalDays[day];
      hasTAcc = true;
    }
    if (doc?.culturalDays && typeof doc.culturalDays[day] === 'number' && doc.culturalDays[day] > 0) {
      cAcc = doc.culturalDays[day];
      hasCAcc = true;
    }

    let tFood = techFoodPrice;
    let cFood = cultFoodPrice;
    let hasTFood = false;
    let hasCFood = false;

    if (doc?.technicalFoodDays && typeof doc.technicalFoodDays[day] === 'number' && doc.technicalFoodDays[day] > 0) {
      tFood = doc.technicalFoodDays[day];
      hasTFood = true;
    }
    if (doc?.culturalFoodDays && typeof doc.culturalFoodDays[day] === 'number' && doc.culturalFoodDays[day] > 0) {
      cFood = doc.culturalFoodDays[day];
      hasCFood = true;
    }

    if (hasTechnical && hasCultural) {
      accDays[day] = Math.max(tAcc, cAcc);
      const tTotal = tAcc + tFood;
      const cTotal = cAcc + cFood;
      const total = Math.max(tTotal, cTotal);
      foodDays[day] = Math.max(total - accDays[day], 0);
    } else if (hasTechnical) {
      accDays[day] = tAcc;
      foodDays[day] = tFood;
    } else if (hasCultural) {
      accDays[day] = cAcc;
      foodDays[day] = cFood;
    } else if (!hasTechnical && !hasCultural) {
      if (plainAcc > 0 && !hasTAcc && !hasCAcc) {
        accDays[day] = plainAcc;
      } else {
        accDays[day] = Math.max(tAcc, cAcc);
      }
      if (plainFood > 0 && !hasTFood && !hasCFood) {
        foodDays[day] = plainFood;
      } else {
        const tTotal = tAcc + tFood;
        const cTotal = cAcc + cFood;
        const total = Math.max(tTotal, cTotal);
        foodDays[day] = Math.max(total - accDays[day], 0);
      }
    } else {
      accDays[day] = Math.max(tAcc, cAcc);
      const tTotal = tAcc + tFood;
      const cTotal = cAcc + cFood;
      const total = Math.max(tTotal, cTotal);
      foodDays[day] = Math.max(total - accDays[day], 0);
    }
  }

  return { accDays, foodDays };
}

/**
 * Calculates the accommodation upgrade fee for existing accommodation days
 * when a user with existing cultural accommodation registers for a technical event.
 */
export function calculateAccommodationUpgrade(
  user: {
    accommodation?: Record<string, boolean>;
    food?: Record<string, boolean>;
    accommodationTier?: string;
  } | null | undefined,
  currentEvent: { id?: string; eventId?: string; category?: string } | null | undefined,
  myEvents: Array<{ event?: { id?: string; eventId?: string; category?: string; paymentRequired?: boolean }; registration?: { paymentStatus?: string; status?: string; eventId?: string } } | any> | null | undefined,
  accDoc: AppAccommodation | null | undefined
): { upgradeDays: Record<string, number>; upgradeFee: number } {
  if (!user?.accommodation || Object.keys(user.accommodation).length === 0) {
    return { upgradeDays: {}, upgradeFee: 0 };
  }

  const currentCat = currentEvent?.category?.toLowerCase();
  if (currentCat !== 'technical') {
    return { upgradeDays: {}, upgradeFee: 0 };
  }

  const currentId = currentEvent?.id || currentEvent?.eventId;

  if (Array.isArray(myEvents)) {
    for (const item of myEvents) {
      const ev = item.event;
      const reg = item.registration;
      const evId = ev?.id || ev?.eventId || reg?.eventId;

      if (reg?.paymentStatus === 'pending' && evId === currentId) {
        continue;
      }

      const isConfirmed =
        reg?.paymentStatus === 'success' ||
        reg?.status === 'confirmed' ||
        (!ev?.paymentRequired && reg != null && reg?.paymentStatus !== 'pending');

      if (isConfirmed && ev?.category?.toLowerCase() === 'technical') {
        return { upgradeDays: {}, upgradeFee: 0 };
      }
    }
  }

  const defaultAcc = 650;
  const defaultFood = 150;

  const techPrice = accDoc?.technicalAmount ?? accDoc?.amount ?? defaultAcc;
  const cultPrice = accDoc?.culturalAmount ?? accDoc?.amount ?? defaultAcc;
  const techFoodPrice = accDoc?.technicalFoodAmount ?? accDoc?.foodAmount ?? defaultFood;
  const cultFoodPrice = accDoc?.culturalFoodAmount ?? accDoc?.foodAmount ?? defaultFood;

  const upgradeDays: Record<string, number> = {};
  let upgradeFee = 0;

  for (const day of FESTIVAL_DAY_KEYS) {
    if (!user.accommodation[day]) {
      continue;
    }

    let tAcc = techPrice;
    let cAcc = cultPrice;
    if (accDoc?.technicalDays && typeof accDoc.technicalDays[day] === 'number' && accDoc.technicalDays[day] > 0) {
      tAcc = accDoc.technicalDays[day];
    }
    if (accDoc?.culturalDays && typeof accDoc.culturalDays[day] === 'number' && accDoc.culturalDays[day] > 0) {
      cAcc = accDoc.culturalDays[day];
    }

    let tFood = techFoodPrice;
    let cFood = cultFoodPrice;
    if (accDoc?.technicalFoodDays && typeof accDoc.technicalFoodDays[day] === 'number' && accDoc.technicalFoodDays[day] > 0) {
      tFood = accDoc.technicalFoodDays[day];
    }
    if (accDoc?.culturalFoodDays && typeof accDoc.culturalFoodDays[day] === 'number' && accDoc.culturalFoodDays[day] > 0) {
      cFood = accDoc.culturalFoodDays[day];
    }

    let diff = 0;
    if (user.food?.[day]) {
      const tTotal = tAcc + tFood;
      const cTotal = cAcc + cFood;
      diff = Math.max(tTotal - cTotal, 0);
    } else {
      diff = Math.max(tAcc - cAcc, 0);
    }

    if (diff > 0) {
      upgradeDays[day] = diff;
      upgradeFee += diff;
    }
  }

  return { upgradeDays, upgradeFee };
}

/**
 * Utilities for event payment calculations and status determinations.
 */

export const isPerIndividualPayment = (paymentType?: string | null): boolean => {
  if (!paymentType) return false;
  const pt = paymentType.toLowerCase().trim();
  return pt === 'per_individual' || pt === 'perhead' || pt === 'per_head' || pt === 'individual';
};

/**
 * Centralized calculation of base event registration fee across individual and team events.
 */
export function calculateEventFee(
  event?: any,
  user?: { isHostCollegeStudent?: boolean; email?: string } | null,
  team?: any
): number {
  if (!event || !event.paymentRequired) return 0;
  const isHost = isHostStudent(user);

  if (event.eventType === 'team' && team) {
    if (isPerIndividualPayment(event.paymentType) && team.members?.length) {
      const totalRosterFee = team.members.reduce((acc: number, m: any) => {
        const memberIsHost = isHostStudent(m);
        return acc + (memberIsHost ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0));
      }, 0);
      return Math.max(0, totalRosterFee - (team.paidTill || 0));
    }
    const flatFee = isHost ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0);
    return Math.max(0, flatFee - (team.paidTill || 0));
  }

  return isHost ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0);
}

export interface EventPaymentStatusParams {
  event?: any;
  team?: any;
  registration?: any;
  userId?: string;
  user?: any;
  myEvents?: any[];
  accDoc?: AppAccommodation | null;
}

/**
 * Checks whether payment is pending/due for the given event registration or team.
 */
export const isEventPaymentDue = ({
  event,
  team,
  registration,
  userId,
  user,
  myEvents,
  accDoc,
}: EventPaymentStatusParams): boolean => {
  // If user owes an accommodation upgrade for this technical event, payment is due
  if (user && event && accDoc) {
    const { upgradeFee } = calculateAccommodationUpgrade(user, event, myEvents, accDoc);
    if (upgradeFee > 0) {
      if (registration?.paymentStatus !== 'success' && registration?.paymentStatus !== 'completed') {
        return true;
      }
    }
  }

  if (!event?.paymentRequired) return false;

  const isTeam = event?.eventType === 'team';
  if (isTeam && team) {
    const isPerInd = isPerIndividualPayment(event?.paymentType);
    const isLeader = userId ? team.leaderUserId === userId : true;

    // Credit-based check: if settled amount covers the team roster fee, payment is not due
    if (team.paidTill && team.paidTill > 0) {
      if (isPerInd && team.members?.length) {
        const totalRosterFee = team.members.reduce((acc: number, m: any) => {
          const memberIsHost = isHostStudent(m);
          return acc + (memberIsHost ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0));
        }, 0);
        if (totalRosterFee > 0 && team.paidTill >= totalRosterFee) {
          return false;
        }
      } else if (!isPerInd) {
        const flatFee = event.registrationFee?.host || event.registrationFee?.other || 0;
        if (flatFee > 0 && team.paidTill >= flatFee) {
          return false;
        }
      }
    }

    if (isPerInd) {
      if (isLeader) {
        // Leader has payment due if team is not marked paid or ANY member is unpaid
        const hasUnpaid = team.members?.some((m: any) => m.paymentStatus !== 'success');
        return !team.paid || !!hasUnpaid;
      } else {
        // Member has payment pending if their own registration is not success
        return registration?.paymentStatus !== 'success';
      }
    } else {
      // Flat team fee
      return !team.paid;
    }
  }

  // Individual event
  return registration?.paymentStatus !== 'success' && registration?.paymentStatus !== 'completed';
};

/**
 * Checks whether the registration and team fees are completely paid.
 */
export const isEventRegistrationPaid = (params: EventPaymentStatusParams): boolean => {
  if (!params.event?.paymentRequired) return true;
  return !isEventPaymentDue(params);
};
