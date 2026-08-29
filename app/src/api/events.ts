import { FirebaseEvent } from "@/types/models";
import { apiFetch, readError } from "./client";

const toFirebaseEvent = (raw: any): FirebaseEvent => ({
  eventId: raw.eventId || raw.id,
  title: raw.title ?? "",
  description: raw.description ?? "",
  shortDescription: raw.shortDescription ?? "",
  category: raw.category ?? "",
  coordinators: (raw.coordinators ?? []).map((c: any) => ({
    email: c.email ?? "",
    name: c.name ?? "",
    phone: c.phone ?? "",
    userID: c.userID ?? c.userId ?? "",
  })),
  coverImage: raw.coverImage ?? "",
  customFields: raw.customFields ?? [],
  dateTime: raw.dateTime ?? raw.startDateTime ?? "",
  endDateTime: raw.endDateTime ?? "",
  startDateTime: raw.startDateTime ?? raw.dateTime ?? "",
  eventType: raw.eventType ?? "individual",
  externalUrl: raw.externalUrl,
  images: raw.images ?? [],
  isFeatured: !!raw.isFeatured,
  isPublic: raw.isPublic !== false,
  links: Array.isArray(raw.links)
    ? raw.links.map((l: any) => (typeof l === "string" ? l : l?.url ?? "")).filter(Boolean)
    : [],
  maxTeamSize: raw.maxTeamSize,
  minTeamSize: raw.minTeamSize,
  paymentRequired: !!raw.paymentRequired,
  paymentStarted: !!raw.paymentStarted,
  prizes: raw.prizes ?? "",
  shortPrizes: raw.shortPrizes ?? "",
  reelsId: raw.reelsId ?? [],
  registrationDeadline: raw.registrationDeadline ?? "",
  registrationFee: {
    host: raw.registrationFee?.host ?? 0,
    other: raw.registrationFee?.other ?? 0,
  },
  rules: raw.rules ?? "",
  sameCollegeOnly: !!raw.sameCollegeOnly,
  venueId: raw.venueId,
  venueName: raw.venueName,
});

export async function listEvents(params: { category?: string; q?: string } = {}): Promise<FirebaseEvent[]> {
  const query = new URLSearchParams();
  if (params.category && params.category !== "All") query.set("category", params.category);
  if (params.q) query.set("q", params.q);
  query.set("limit", "200");

  const qs = query.toString();
  const path = qs ? `/events?${qs}` : "/events";
  const response = await apiFetch(path, {}, "optional");
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load events"));
  }

  const data = await response.json();
  return (data.items ?? []).map(toFirebaseEvent);
}

export async function getEvent(eventId: string): Promise<FirebaseEvent> {
  const detail = await getEventDetail(eventId);
  return detail.event;
}

export async function getEventDetail(eventId: string): Promise<{
  event: FirebaseEvent;
  myRegistration: any | null;
  myTeam: any | null;
}> {
  const response = await apiFetch(`/events/${eventId}`, {}, "optional");
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load event"));
  }
  const data = await response.json();
  return {
    event: toFirebaseEvent(data.event),
    myRegistration: data.myRegistration ?? null,
    myTeam: data.myTeam ?? null,
  };
}

export function responsesFromFields(customFields: any[] = [], values: Record<string, any> = {}) {
  return customFields.map((field: any) => ({
    fieldId: field.fieldId,
    label: field.label,
    type: field.type,
    value: values[field.fieldId] ?? (field.type === "multi-select" ? [] : ""),
  }));
}

export async function registerForEvent(eventId: string, responses: any[] = []) {
  const response = await apiFetch(
    `/events/${eventId}/register`,
    { method: "POST", body: JSON.stringify({ responses }) },
    "required",
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to register"));
  }
  return response.json();
}

export async function createEventTeam(eventId: string, teamName: string, responses: any[] = []) {
  const response = await apiFetch(
    `/events/${eventId}/teams`,
    { method: "POST", body: JSON.stringify({ teamName, responses }) },
    "required",
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to create team"));
  }
  return response.json();
}

export async function joinEventTeam(eventId: string, inviteCode: string, responses: any[] = []) {
  const response = await apiFetch(
    "/teams/join",
    { method: "POST", body: JSON.stringify({ eventId, inviteCode, responses }) },
    "required",
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to join team"));
  }
  return response.json();
}

export async function getTeam(teamRef: string) {
  const response = await apiFetch(`/teams/${teamRef}`, {}, "required");
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load team"));
  }
  const data = await response.json();
  return data.team;
}

export async function leaveTeam(teamRef: string) {
  const response = await apiFetch(`/teams/${teamRef}/leave`, { method: "POST" }, "required");
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to leave team"));
  }
}

export async function deleteTeam(teamRef: string) {
  const response = await apiFetch(`/teams/${teamRef}`, { method: "DELETE" }, "required");
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to delete team"));
  }
}

export async function removeTeamMember(teamRef: string, userId: string) {
  const response = await apiFetch(
    `/teams/${teamRef}/members/${userId}`,
    { method: "DELETE" },
    "required",
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to remove member"));
  }
}

export async function getMyEvents(): Promise<Array<{ event: FirebaseEvent; registration: any; team?: any }>> {
  const response = await apiFetch("/me/events", {}, "required");
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load your events"));
  }
  const data = await response.json();
  return (data.items ?? []).map((row: any) => ({
    event: row.event ? toFirebaseEvent(row.event) : undefined,
    registration: row.registration,
    team: row.team,
  }));
}

export async function getCategories(): Promise<string[]> {
  const response = await apiFetch("/events/categories", {}, "optional");
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to load categories"));
  }
  const data = await response.json();
  return data.categories ?? [];
}


// Aliases for admin screens that used old API names
export const getEvents = listEvents;

// Old Firestore real-time subscription — replaced with a one-shot poll
export const subscribeToEvents = (callback: (events: any[]) => void) => {
  listEvents().then(callback).catch(console.error);
  return () => {}; // no-op unsubscribe
};
