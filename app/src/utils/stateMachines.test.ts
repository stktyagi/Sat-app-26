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

function calculateEventFee(
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
