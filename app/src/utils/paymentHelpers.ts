import type { AppAccommodation } from "@/api/appConfig";

export interface StayDayPrices {
  accDays: Record<string, number>;
  foodDays: Record<string, number>;
}

export const FESTIVAL_DAY_KEYS = ["day0", "day1", "day2", "day3", "day4"];

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
 * Utilities for event payment calculations and status determinations.
 */

export const isPerIndividualPayment = (paymentType?: string | null): boolean => {
  if (!paymentType) return false;
  const pt = paymentType.toLowerCase().trim();
  return pt === 'per_individual' || pt === 'perhead' || pt === 'per_head' || pt === 'individual';
};

export interface EventPaymentStatusParams {
  event?: any;
  team?: any;
  registration?: any;
  userId?: string;
}

/**
 * Checks whether payment is pending/due for the given event registration or team.
 */
export const isEventPaymentDue = ({
  event,
  team,
  registration,
  userId,
}: EventPaymentStatusParams): boolean => {
  if (!event?.paymentRequired) return false;

  const isTeam = event?.eventType === 'team';
  if (isTeam && team) {
    const isPerInd = isPerIndividualPayment(event?.paymentType);
    const isLeader = userId ? team.leaderUserId === userId : true;

    // Credit-based check: if settled amount covers the team roster fee, payment is not due
    if (team.paidTill && team.paidTill > 0) {
      if (isPerInd && team.members?.length) {
        const totalRosterFee = team.members.reduce((acc: number, m: any) => {
          return acc + (m.isHostCollegeStudent ? (event.registrationFee?.host || 0) : (event.registrationFee?.other || 0));
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
