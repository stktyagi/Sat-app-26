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

  const pick = (
    day: string,
    techDays?: Record<string, number>,
    cultDays?: Record<string, number>,
    tech: number = defaultAcc,
    cult: number = defaultAcc,
    plain: number = defaultAcc
  ): number => {
    let t = tech;
    let c = cult;
    let hasT = false;
    let hasC = false;

    if (techDays && typeof techDays[day] === 'number' && techDays[day] > 0) {
      t = techDays[day];
      hasT = true;
    }
    if (cultDays && typeof cultDays[day] === 'number' && cultDays[day] > 0) {
      c = cultDays[day];
      hasC = true;
    }

    if (hasTechnical && hasCultural) {
      return Math.max(t, c);
    }
    if (hasTechnical) {
      return t;
    }
    if (hasCultural) {
      return c;
    }
    if (plain > 0 && !hasT && !hasC) {
      return plain;
    }
    return Math.max(t, c);
  };

  const accDays: Record<string, number> = {};
  const foodDays: Record<string, number> = {};

  for (const day of FESTIVAL_DAY_KEYS) {
    accDays[day] = pick(day, doc?.technicalDays, doc?.culturalDays, techPrice, cultPrice, plainAcc);
    foodDays[day] = pick(day, doc?.technicalFoodDays, doc?.culturalFoodDays, techFoodPrice, cultFoodPrice, plainFood);
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
