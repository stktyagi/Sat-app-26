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
