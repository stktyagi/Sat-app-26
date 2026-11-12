export type HostelGender = "boys" | "girls";

export interface HostelOption {
  code: string;
  newName: string;
  oldName: string;
  gender: HostelGender;
}

export const HOSTEL_LIST: HostelOption[] = [
  // Boys' Hostels
  { code: "Hostel_A", newName: "Agira Hall", oldName: "Hostel A", gender: "boys" },
  { code: "Hostel_B", newName: "Amritam Hall", oldName: "Hostel B", gender: "boys" },
  { code: "Hostel_C", newName: "Prithvi Hall", oldName: "Hostel C", gender: "boys" },
  { code: "Hostel_D", newName: "Neeram Hall", oldName: "Hostel D", gender: "boys" },
  { code: "Hostel_FRF", newName: "", oldName: "Hostel FRF", gender: "boys" },
  { code: "Hostel_FRG", newName: "", oldName: "Hostel FRG", gender: "boys" },
  { code: "Hostel_H", newName: "Vyan Hall", oldName: "Hostel H", gender: "boys" },
  { code: "Hostel_J", newName: "Tejas Hall", oldName: "Hostel J", gender: "boys" },
  { code: "Hostel_K", newName: "Ambaram Hall", oldName: "Hostel K", gender: "boys" },
  { code: "Hostel_L", newName: "Viyat Hall", oldName: "Hostel L", gender: "boys" },
  { code: "Hostel_M", newName: "Anantam Hall", oldName: "Hostel M", gender: "boys" },
  { code: "Hostel_O", newName: "Vyom Hall", oldName: "Hostel O", gender: "boys" },

  // Girls' Hostels
  { code: "Hostel_E", newName: "Vasudha Hall", oldName: "Hostel E", gender: "girls" },
  { code: "Hostel_G", newName: "Vasudha Hall", oldName: "Hostel G", gender: "girls" },
  { code: "Hostel_I", newName: "Ira Hall", oldName: "Hostel I", gender: "girls" },
  { code: "Hostel_N", newName: "Ananta Hall", oldName: "Hostel N", gender: "girls" },
  { code: "Hostel_Q", newName: "Vahni Hall", oldName: "Hostel Q", gender: "girls" },
  { code: "Hostel_PG_1", newName: "Dhriti Hall", oldName: "Hostel PG 1", gender: "girls" },
  { code: "Hostel_PG_2", newName: "Pavani Hall", oldName: "Hostel PG 2", gender: "girls" },
];

export const BOYS_HOSTELS = HOSTEL_LIST.filter((h) => h.gender === "boys");
export const GIRLS_HOSTELS = HOSTEL_LIST.filter((h) => h.gender === "girls");

/**
 * Returns formatted primary and secondary labels for dropdown display.
 * FRF and FRG are exceptions that do not show a new name.
 */
export function getHostelItemLabels(hostel: HostelOption): { primary: string; secondary?: string } {
  if (!hostel.newName) {
    return { primary: hostel.oldName };
  }
  return {
    primary: hostel.newName,
    secondary: hostel.oldName,
  };
}

/**
 * Returns a human-friendly combined name:
 * e.g. "Agira Hall (Hostel A)" or "Hostel FRF"
 */
export function formatHostelName(hostel: HostelOption): string {
  if (!hostel.newName) {
    return hostel.oldName;
  }
  return `${hostel.newName} (${hostel.oldName})`;
}

/**
 * Finds a HostelOption by code, oldName, or newName (case-insensitive).
 */
export function findHostel(query?: string | null): HostelOption | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  // 1. Direct code match
  const byCode = HOSTEL_LIST.find((h) => h.code.toLowerCase() === q);
  if (byCode) return byCode;

  // 2. Normalize underscores/spaces (e.g. "hostel_a" vs "hostel a")
  const normalizedQ = q.replace(/[_\s-]+/g, "");
  const byNormalizedCode = HOSTEL_LIST.find(
    (h) => h.code.toLowerCase().replace(/[_\s-]+/g, "") === normalizedQ
  );
  if (byNormalizedCode) return byNormalizedCode;

  // 3. Match oldName
  const byOldName = HOSTEL_LIST.find((h) => h.oldName.toLowerCase() === q);
  if (byOldName) return byOldName;

  // 4. Match newName
  const byNewName = HOSTEL_LIST.find((h) => h.newName && h.newName.toLowerCase() === q);
  if (byNewName) return byNewName;

  // 5. Match single letter (e.g. "A" -> Hostel A, "M" -> Hostel M)
  if (q.length <= 3) {
    const byLetter = HOSTEL_LIST.find(
      (h) => h.oldName.toLowerCase().replace("hostel", "").trim() === q
    );
    if (byLetter) return byLetter;
  }

  return undefined;
}

/**
 * Formats a stored hostel value + optional room number into a polished display string.
 */
export function formatHostelDisplay(
  codeOrRaw?: string | null,
  roomNo?: string | null
): string {
  if (!codeOrRaw && !roomNo) return "";
  const found = findHostel(codeOrRaw);
  const baseName = found ? formatHostelName(found) : codeOrRaw || "";
  const cleanRoom = roomNo ? roomNo.trim() : "";

  if (baseName && cleanRoom) {
    return `${baseName} • Room ${cleanRoom}`;
  }
  if (baseName) return baseName;
  return cleanRoom ? `Room ${cleanRoom}` : "";
}

/**
 * Matches a user's allotted hostel & room number against a search query.
 */
export function matchHostelSearch(
  hostelVal?: string | null,
  roomNo?: string | null,
  query?: string | null
): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;

  if (roomNo && roomNo.toLowerCase().includes(q)) return true;
  if (hostelVal && hostelVal.toLowerCase().includes(q)) return true;

  const found = findHostel(hostelVal);
  if (found) {
    if (found.code.toLowerCase().includes(q)) return true;
    if (found.oldName.toLowerCase().includes(q)) return true;
    if (found.newName && found.newName.toLowerCase().includes(q)) return true;
  }

  return false;
}
