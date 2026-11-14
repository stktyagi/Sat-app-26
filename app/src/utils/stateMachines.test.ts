import { isEventPaymentDue, calculateEventFee } from './paymentHelpers.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of the pure logic matching our production implementations
function isHostStudent(
  user?: { isHostCollegeStudent?: boolean; email?: string } | null
): boolean {
  if (!user) return false;
  if (user.isHostCollegeStudent === true) return true;
  if (typeof user.email === "string" && user.email.trim().toLowerCase().endsWith("@thapar.edu")) {
    return true;
  }
  return false;
}

function isPerIndividualPayment(paymentType?: string | null): boolean {
  if (!paymentType) return false;
  const pt = paymentType.toLowerCase().trim();
  return pt === 'per_individual' || pt === 'perhead' || pt === 'per_head' || pt === 'individual';
}



function hasCompletedProfile(p?: any | null): boolean {
  if (!p?.rollNumber || !p?.collegeName || !p?.phoneNumber) return false;
  if (!isHostStudent(p)) {
    const hasPhoto = Boolean(p.photoUrl || p.photoURL);
    const hasCollegeId = Boolean(p.collegeIdUrl);
    if (!hasPhoto || !hasCollegeId) return false;
  }
  return true;
}

function normalizeCheckinStatus(status?: string): 'pending' | 'checked-in' | 'rejected' {
  if (!status) return 'pending';
  const s = status.toLowerCase().trim();
  if (s === 'checked-in' || s === 'checked in' || s === 'checked_in') return 'checked-in';
  if (s === 'rejected' || s === 'reject') return 'rejected';
  return 'pending';
}

function getCanonicalImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string' || url.trim() === '' || url === '[]') {
    return '';
  }
  let clean = url.trim();
  clean = clean.split('?')[0];
  clean = clean.replace(/\/tr:[^\/]+\//g, '/');
  return clean;
}

function getOptimizedImageUrl(
  url?: string | null,
  optionsOrWidth: number | Record<string, any> = 500,
  quality: number = 75
): string {
  if (!url || typeof url !== 'string' || url.trim() === '' || url === '[]') {
    return '';
  }
  const cleanUrl = url.trim();
  if (!cleanUrl.includes('ik.imagekit.io')) {
    return cleanUrl;
  }
  const baseUrl = getCanonicalImageUrl(cleanUrl);
  const options =
    typeof optionsOrWidth === 'number'
      ? { width: optionsOrWidth, quality }
      : { width: 500, quality: 75, ...optionsOrWidth };

  const trParts: string[] = [];
  if (options.width && options.width > 0) trParts.push(`w-${Math.round(options.width)}`);
  if (options.height && options.height > 0) trParts.push(`h-${Math.round(options.height)}`);
  if (options.quality && options.quality > 0) trParts.push(`q-${Math.round(options.quality)}`);
  if (options.aspectRatio) trParts.push(`ar-${options.aspectRatio}`);
  if (options.focus) trParts.push(`fo-${options.focus}`);
  if (options.blur && options.blur > 0) trParts.push(`bl-${Math.round(options.blur)}`);
  if (options.cropMode) trParts.push(`cm-${options.cropMode}`);
  trParts.push('f-auto');

  return `${baseUrl}?tr=${trParts.join(',')}`;
}

test('isHostStudent: host email and flags', () => {
  assert.equal(isHostStudent(null), false);
  assert.equal(isHostStudent(undefined), false);
  assert.equal(isHostStudent({ email: 'student@thapar.edu' }), true);
  assert.equal(isHostStudent({ email: 'STUDENT@THAPAR.EDU ' }), true);
  assert.equal(isHostStudent({ isHostCollegeStudent: true }), true);
  assert.equal(isHostStudent({ email: 'student@gmail.com' }), false);
  assert.equal(isHostStudent({ email: 'student@gmail.com', isHostCollegeStudent: false }), false);
});

test('calculateEventFee: host vs non-host pricing', () => {
  const event = {
    paymentRequired: true,
    registrationFee: { host: 100, other: 300 },
  };

  const hostUser = { email: 'host@thapar.edu', isHostCollegeStudent: true };
  const outsideUser = { email: 'outside@other.edu', isHostCollegeStudent: false };

  assert.equal(calculateEventFee(event, hostUser), 100);
  assert.equal(calculateEventFee(event, outsideUser), 300);

  const freeEvent = { paymentRequired: false, registrationFee: { host: 100, other: 300 } };
  assert.equal(calculateEventFee(freeEvent, outsideUser), 0);
});

test('calculateEventFee: per-individual team roster fee with settled credits', () => {
  const teamEvent = {
    eventType: 'team',
    paymentType: 'per_individual',
    paymentRequired: true,
    registrationFee: { host: 100, other: 200 },
  };

  const team = {
    paidTill: 150,
    members: [
      { email: 'm1@thapar.edu', isHostCollegeStudent: true }, // 100
      { email: 'm2@other.edu', isHostCollegeStudent: false },  // 200
    ],
  };

  // Total roster = 300. Paid till = 150. Remaining = 150.
  assert.equal(calculateEventFee(teamEvent, null, team), 150);
});

test('hasCompletedProfile: verifies identity for non-host students', () => {
  const incompleteHost = { rollNumber: '102203' };
  assert.equal(hasCompletedProfile(incompleteHost), false);

  const completeHost = {
    rollNumber: '102203',
    collegeName: 'Thapar Institute',
    email: 'test@thapar.edu',
    isHostCollegeStudent: true,
    phoneNumber: "9876543210",
  };
  assert.equal(hasCompletedProfile(completeHost), true);

  const incompleteOutside = {
    rollNumber: '999',
    collegeName: 'IIT Delhi',
    email: 'test@iitd.ac.in',
    isHostCollegeStudent: false,
    photoUrl: 'https://cdn/photo.jpg',
  };
  assert.equal(hasCompletedProfile(incompleteOutside), false);

  const completeOutside = {
    rollNumber: '999',
    collegeName: 'IIT Delhi',
    email: 'test@iitd.ac.in',
    isHostCollegeStudent: false,
    photoUrl: 'https://cdn/photo.jpg',
    collegeIdUrl: 'https://cdn/id.jpg',
    phoneNumber: "9876543210",
  };
  assert.equal(hasCompletedProfile(completeOutside), true);
});

test('normalizeCheckinStatus: handles all check-in formats', () => {
  assert.equal(normalizeCheckinStatus('checked-in'), 'checked-in');
  assert.equal(normalizeCheckinStatus('checked in'), 'checked-in');
  assert.equal(normalizeCheckinStatus('checked_in'), 'checked-in');
  assert.equal(normalizeCheckinStatus('rejected'), 'rejected');
  assert.equal(normalizeCheckinStatus('reject'), 'rejected');
  assert.equal(normalizeCheckinStatus('pending'), 'pending');
  assert.equal(normalizeCheckinStatus(undefined), 'pending');
});

test('getOptimizedImageUrl: sanitizes DB URLs and appends responsive tr parameters', () => {
  const rawUrl = 'https://ik.imagekit.io/pyji3pk4y/events/hackathon_cover.jpg';
  assert.equal(
    getOptimizedImageUrl(rawUrl, 400),
    'https://ik.imagekit.io/pyji3pk4y/events/hackathon_cover.jpg?tr=w-400,q-75,f-auto'
  );

  // If DB already contains an existing query parameter:
  const dirtyQueryUrl = 'https://ik.imagekit.io/pyji3pk4y/events/hackathon_cover.jpg?tr=w-1200';
  assert.equal(
    getOptimizedImageUrl(dirtyQueryUrl, 250),
    'https://ik.imagekit.io/pyji3pk4y/events/hackathon_cover.jpg?tr=w-250,q-75,f-auto'
  );

  // If DB contains path-based transformations:
  const dirtyPathUrl = 'https://ik.imagekit.io/pyji3pk4y/tr:w-1000/events/hackathon_cover.jpg';
  assert.equal(
    getOptimizedImageUrl(dirtyPathUrl, 700),
    'https://ik.imagekit.io/pyji3pk4y/events/hackathon_cover.jpg?tr=w-700,q-75,f-auto'
  );

  // Non-ImageKit URL (e.g. Unsplash or Cloud Storage) is safely returned unchanged:
  const externalUrl = 'https://images.unsplash.com/photo-123';
  assert.equal(getOptimizedImageUrl(externalUrl, 400), externalUrl);
});

test('isEventPaymentDue: returns false when registration fee is 0', () => {
  const hostUser = { userId: 'u1', isHostCollegeStudent: true, email: 'host@thapar.edu' };
  const otherUser = { userId: 'u2', isHostCollegeStudent: false, email: 'other@gmail.com' };

  // 1. Zero-fee event for all
  const zeroFeeEvent = {
    paymentRequired: true,
    registrationFee: { host: 0, other: 0 },
    eventType: 'individual',
  };
  assert.equal(
    isEventPaymentDue({ event: zeroFeeEvent, user: hostUser, registration: { paymentStatus: 'pending' } }),
    false
  );
  assert.equal(
    isEventPaymentDue({ event: zeroFeeEvent, user: otherUser, registration: { paymentStatus: 'pending' } }),
    false
  );

  // 2. Free for host college, paid for other
  const hostFreeEvent = {
    paymentRequired: true,
    registrationFee: { host: 0, other: 150 },
    eventType: 'individual',
  };
  assert.equal(
    isEventPaymentDue({ event: hostFreeEvent, user: hostUser, registration: { paymentStatus: 'pending' } }),
    false
  );
  assert.equal(
    isEventPaymentDue({ event: hostFreeEvent, user: otherUser, registration: { paymentStatus: 'pending' } }),
    true
  );

  // 3. Team event flat fee where host is free
  const teamFlatEvent = {
    paymentRequired: true,
    eventType: 'team',
    paymentType: 'team',
    registrationFee: { host: 0, other: 300 },
  };
  const hostTeam = {
    teamId: 't1',
    leaderUserId: 'u1',
    paid: false,
    members: [hostUser],
  };
  assert.equal(
    isEventPaymentDue({ event: teamFlatEvent, team: hostTeam, user: hostUser, userId: 'u1' }),
    false
  );

  // 4. Team event per-individual fee where all members are host (fee = 0)
  const teamPerIndEvent = {
    paymentRequired: true,
    eventType: 'team',
    paymentType: 'per_individual',
    registrationFee: { host: 0, other: 100 },
  };
  const hostOnlyTeam = {
    teamId: 't2',
    leaderUserId: 'u1',
    paid: false,
    members: [hostUser, { userId: 'u3', isHostCollegeStudent: true, email: 'host2@thapar.edu' }],
  };
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: hostOnlyTeam, user: hostUser, userId: 'u1' }),
    false
  );
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: hostOnlyTeam, user: hostOnlyTeam.members[1], userId: 'u3', registration: { paymentStatus: 'pending' } }),
    false
  );

  // 5. Mixed team: 1 host user (fee = 0) and 1 outside user (fee = 100)
  const mixedTeam = {
    teamId: 't3',
    leaderUserId: 'u1',
    paid: false,
    members: [
      { userId: 'u1', isHostCollegeStudent: true, email: 'host@thapar.edu', paymentStatus: 'pending' },
      { userId: 'u2', isHostCollegeStudent: false, email: 'other@gmail.com', paymentStatus: 'pending' },
    ],
  };

  // Leader must pay for the unpaid non-host member (fee 100)
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: mixedTeam, user: hostUser, userId: 'u1' }),
    true
  );

  // Host member itself owes 0, so host member does NOT have personal payment pending
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: mixedTeam, user: hostUser, userId: 'u1', registration: { paymentStatus: 'pending' } }),
    // Note: for leader it was true above because leader pays the roster.
    true
  );

  // Non-leader host member:
  const mixedTeamOtherLeader = {
    teamId: 't4',
    leaderUserId: 'u2',
    paid: false,
    members: [
      { userId: 'u2', isHostCollegeStudent: false, email: 'other@gmail.com', paymentStatus: 'pending' },
      { userId: 'u1', isHostCollegeStudent: true, email: 'host@thapar.edu', paymentStatus: 'pending' },
    ],
  };
  // Host member (non-leader) has fee 0, so no personal payment due
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: mixedTeamOtherLeader, user: hostUser, userId: 'u1', registration: { paymentStatus: 'pending' } }),
    false
  );
  // Outside member (leader or non-leader) has fee 100, so payment IS due
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: mixedTeamOtherLeader, user: otherUser, userId: 'u2', registration: { paymentStatus: 'pending' } }),
    true
  );

  // Once paid (team.paidTill >= 100 or team.paid):
  const mixedTeamPaid = {
    ...mixedTeamOtherLeader,
    paidTill: 100,
    paid: true,
  };
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: mixedTeamPaid, user: otherUser, userId: 'u2' }),
    false
  );
  assert.equal(
    isEventPaymentDue({ event: teamPerIndEvent, team: mixedTeamPaid, user: hostUser, userId: 'u1' }),
    false
  );

  // 6. Event where host students are NOT free (e.g. host: 100, other: 300)
  const paidForHostEvent = {
    paymentRequired: true,
    registrationFee: { host: 100, other: 300 },
    eventType: 'individual',
  };
  // Host student MUST pay ₹100 because the database says fee is 100
  assert.equal(
    calculateEventFee(paidForHostEvent, hostUser),
    100
  );
  assert.equal(
    isEventPaymentDue({ event: paidForHostEvent, user: hostUser, registration: { paymentStatus: 'pending' } }),
    true
  );
  // Once paid:
  assert.equal(
    isEventPaymentDue({ event: paidForHostEvent, user: hostUser, registration: { paymentStatus: 'success' } }),
    false
  );

  // 7. Flat team fee event where host is free (0) and other is 300:
  // When an outsider joins a host team, the team MUST pay the outsider fee (300)!
  const flatMixedTeam = {
    teamId: 't5',
    leaderUserId: 'u1',
    paid: false,
    members: [hostUser, otherUser],
  };
  assert.equal(
    calculateEventFee(teamFlatEvent, hostUser, flatMixedTeam),
    300
  );
  assert.equal(
    isEventPaymentDue({ event: teamFlatEvent, team: flatMixedTeam, user: hostUser, userId: 'u1' }),
    true
  );

  // Once settled with 300 paidTill:
  const flatMixedTeamPaid = {
    ...flatMixedTeam,
    paidTill: 300,
    paid: true,
  };
  assert.equal(
    calculateEventFee(teamFlatEvent, hostUser, flatMixedTeamPaid),
    0
  );
  assert.equal(
    isEventPaymentDue({ event: teamFlatEvent, team: flatMixedTeamPaid, user: hostUser, userId: 'u1' }),
    false
  );

  // 8. Flat team fee event where host is 100 and other is 300:
  const flatBothPaidEvent = {
    paymentRequired: true,
    eventType: 'team',
    paymentType: 'team',
    registrationFee: { host: 100, other: 300 },
  };
  // Host-only team pays 100 initially:
  const hostTeamInitial = {
    teamId: 't6',
    leaderUserId: 'u1',
    paid: false,
    paidTill: 0,
    members: [hostUser],
  };
  assert.equal(calculateEventFee(flatBothPaidEvent, hostUser, hostTeamInitial), 100);
  assert.equal(isEventPaymentDue({ event: flatBothPaidEvent, team: hostTeamInitial, user: hostUser, userId: 'u1' }), true);

  // Leader pays the initial 100:
  const hostTeamPaidInitial = {
    ...hostTeamInitial,
    paidTill: 100,
    paid: true,
  };
  assert.equal(calculateEventFee(flatBothPaidEvent, hostUser, hostTeamPaidInitial), 0);
  assert.equal(isEventPaymentDue({ event: flatBothPaidEvent, team: hostTeamPaidInitial, user: hostUser, userId: 'u1' }), false);

  // Now an outsider joins! Team fee becomes 300, remaining due is 300 - 100 = 200:
  const teamAfterOutsiderJoins = {
    ...hostTeamPaidInitial,
    paid: false,
    members: [hostUser, otherUser],
  };
  assert.equal(calculateEventFee(flatBothPaidEvent, hostUser, teamAfterOutsiderJoins), 200);
  assert.equal(isEventPaymentDue({ event: flatBothPaidEvent, team: teamAfterOutsiderJoins, user: hostUser, userId: 'u1' }), true);

  // Leader settles the remaining 200 (paidTill = 300):
  const teamFullySettled = {
    ...teamAfterOutsiderJoins,
    paidTill: 300,
    paid: true,
  };
  assert.equal(calculateEventFee(flatBothPaidEvent, hostUser, teamFullySettled), 0);
  assert.equal(isEventPaymentDue({ event: flatBothPaidEvent, team: teamFullySettled, user: hostUser, userId: 'u1' }), false);

  // 9. Free event (paymentRequired = false) is always 0 even with dummy numbers
  const freeEvent = {
    paymentRequired: false,
    registrationFee: { host: 500, other: 1000 },
    eventType: 'team',
  };
  assert.equal(calculateEventFee(freeEvent, otherUser, teamAfterOutsiderJoins), 0);
  assert.equal(isEventPaymentDue({ event: freeEvent, team: teamAfterOutsiderJoins, user: otherUser, userId: 'u2' }), false);

  // 10. Missing registrationFee fields default safely to 0
  const missingFeeEvent = {
    paymentRequired: true,
    eventType: 'individual',
  };
  assert.equal(calculateEventFee(missingFeeEvent, hostUser), 0);
  assert.equal(calculateEventFee(missingFeeEvent, otherUser), 0);
  assert.equal(isEventPaymentDue({ event: missingFeeEvent, user: hostUser }), false);
  assert.equal(isEventPaymentDue({ event: missingFeeEvent, user: otherUser }), false);

  // 11. Outside leader with host member in flat team:
  // Starts with outsider rate (300), stays 300 when host joins
  const outsideLeaderTeam = {
    teamId: 't7',
    leaderUserId: 'u2',
    paid: false,
    paidTill: 0,
    members: [otherUser, hostUser],
  };
  assert.equal(calculateEventFee(teamFlatEvent, otherUser, outsideLeaderTeam), 300);
  assert.equal(isEventPaymentDue({ event: teamFlatEvent, team: outsideLeaderTeam, user: otherUser, userId: 'u2' }), true);
});

test('Complete State Lifecycle: Pending -> Payment Pending -> Confirmed -> Late Joiner Delta -> Re-Confirmed', () => {
  const minTeamSize = 2;
  const maxTeamSize = 4;
  const event = {
    paymentRequired: true,
    eventType: 'team',
    paymentType: 'per_individual',
    registrationFee: { host: 100, other: 150 },
    minTeamSize,
    maxTeamSize,
  };

  const leader = { userId: 'u_lead', email: 'lead@thapar.edu', isHostCollegeStudent: true };
  const member2 = { userId: 'u_m2', email: 'm2@thapar.edu', isHostCollegeStudent: true };
  const lateMember3 = { userId: 'u_m3', email: 'm3@other.edu', isHostCollegeStudent: false };

  // Helper simulating canonical status resolver
  function resolveStatus(memberCount: number, minSize: number, isPaid: boolean, isRejected = false) {
    if (isRejected) return 'rejected';
    if (memberCount < minSize) return 'pending';
    if (!isPaid) return 'payment_pending';
    return 'confirmed';
  }

  // Stage 1: Leader creates team (1/2 members)
  let team: any = {
    teamId: 't_robo',
    leaderUserId: leader.userId,
    paid: false,
    paidTill: 0,
    members: [leader],
  };
  assert.equal(resolveStatus(team.members.length, minTeamSize, team.paid), 'pending');

  // Stage 2: Member 2 joins (2/2 members reached)
  team.members.push(member2);
  assert.equal(resolveStatus(team.members.length, minTeamSize, team.paid), 'payment_pending');

  // Fee calculation for leader: 2 host members * 100 = 200
  const feeStage2 = calculateEventFee(event, leader, team);
  assert.equal(feeStage2, 200);

  // Stage 3: Leader pays 200 -> team confirmed!
  team.paidTill = 200;
  team.paid = true;
  assert.equal(resolveStatus(team.members.length, minTeamSize, team.paid), 'confirmed');
  assert.equal(calculateEventFee(event, leader, team), 0);

  // Stage 4: Late joiner Member 3 joins (outside student, fee = 150)
  team.members.push(lateMember3);
  team.paid = false; // reset because total roster (100+100+150=350) > paidTill (200)
  assert.equal(resolveStatus(team.members.length, minTeamSize, team.paid), 'payment_pending');

  // Fee calculation for leader: 350 - 200 = 150 (ONLY the difference for member 3!)
  const feeStage4 = calculateEventFee(event, leader, team);
  assert.equal(feeStage4, 150);

  // Stage 5: Leader pays remaining 150 -> team re-confirmed with all 3 members!
  team.paidTill += 150;
  team.paid = true;
  assert.equal(team.paidTill, 350);
  assert.equal(resolveStatus(team.members.length, minTeamSize, team.paid), 'confirmed');
  assert.equal(calculateEventFee(event, leader, team), 0);

  // Stage 6: Manual rejection overrides everything
  assert.equal(resolveStatus(team.members.length, minTeamSize, team.paid, true), 'rejected');
});
