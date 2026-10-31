import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { API_BASE_URL } from "../config/api";
import * as Sentry from "@sentry/react-native";

export async function getIdTokenIfSignedIn(): Promise<string | null> {
  try {
    const user = getAuth(getApp()).currentUser;
    if (!user) return null;
    return await user.getIdToken(false);
  } catch (error) {
    console.warn("Error getting ID token:", error);
    return null;
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  auth: "none" | "optional" | "required" = "optional"
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (init.headers && typeof init.headers === "object" && !Array.isArray(init.headers) && !(init.headers instanceof Headers)) {
    Object.assign(headers, init.headers as Record<string, string>);
  }

  // Allow FormData to set boundary automatically
  if (init.body instanceof FormData || headers["Content-Type"] === "" || headers["Content-Type"] === "multipart/form-data") {
    delete headers["Content-Type"];
  }

  if (auth !== "none") {
    const token = await getIdTokenIfSignedIn();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else if (auth === "required") {
      throw new Error("Not authenticated");
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status >= 400) {
    let responseBody = "";

    try {
      responseBody = (await response.clone().text()).slice(0, 4000);
    } catch {
      responseBody = "<unable to read response body>";
    }

    Sentry.logger.error("Backend request failed", {
      method: init?.method ?? "GET",
      path,
      statusCode: response.status,
      statusText: response.statusText,
      responseBody,
    });
  }

  return response;
}

// Backend messages for these codes are written for developers (they name endpoints).
const FRIENDLY_ERRORS: Record<string, string> = {
  profile_incomplete:
    "We just need your name and phone number to save your spot. Add them in the form and try again.",
  photo_required:
    "Participants from other colleges need a profile photo to register. Please reach out to the Saturnalia team for help.",
  college_id_required:
    "Participants from other colleges need to upload their college ID to register. Please reach out to the Saturnalia team for help.",
};

export async function readError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const errorData = await response.json();
    const code = errorData?.error?.code;
    if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
    if (typeof errorData?.error === "string") return errorData.error;
    if (typeof errorData?.error?.message === "string")
      return errorData.error.message;
    if (typeof errorData?.message === "string") return errorData.message;
    return fallback;
  } catch {
    return fallback;
  }
}
