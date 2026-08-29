import { getApp } from "@react-native-firebase/app";
import { getAuth, getIdToken } from "@react-native-firebase/auth";
import { API_BASE_URL } from "../config/api";

export async function getIdTokenIfSignedIn(): Promise<string | null> {
  try {
    const user = getAuth(getApp()).currentUser;
    if (!user) return null;
    return await getIdToken(user, false);
  } catch {
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

  if (auth !== "none") {
    const token = await getIdTokenIfSignedIn();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else if (auth === "required") {
      throw new Error("Not authenticated");
    }
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function readError(response: Response, fallback: string): Promise<string> {
  const errorData = await response.json().catch(() => ({ message: undefined as string | undefined }));
  return errorData.message || fallback;
}
