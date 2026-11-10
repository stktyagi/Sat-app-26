import { apiFetch, getIdTokenIfSignedIn } from "./client";
import { API_BASE_URL } from "../config/api";
import type { UserProfile } from "../types/models";

export interface MealVerificationResult {
  paid: boolean;
  statusText: string;
  message: string;
  day?: string;
  timestamp: string;
  rawResponse?: any;
}

/**
 * Extracts a boolean paid/active status from any backend response format.
 * Supports:
 * - Direct boolean: true | false
 * - String responses: "yes" | "no" | "true" | "false" | "paid" | "unpaid"
 * - JSON with: paid, hasPaid, food, status, success, valid, verified, available, result, etc.
 */
export function parseMealPaidStatus(data: any): boolean {
  if (data === null || data === undefined) return false;

  if (typeof data === "boolean") return data;

  if (typeof data === "number") return data === 1;

  if (typeof data === "string") {
    const s = data.toLowerCase().trim();
    if (["true", "yes", "paid", "success", "approved", "valid", "active", "1", "ok"].includes(s)) {
      return true;
    }
    if (["false", "no", "unpaid", "failed", "rejected", "invalid", "inactive", "0"].includes(s)) {
      return false;
    }
  }

  if (typeof data === "object") {
    // Priority keys for paid status
    if (data.paid !== undefined) return parseMealPaidStatus(data.paid);
    if (data.hasPaid !== undefined) return parseMealPaidStatus(data.hasPaid);
    if (data.food !== undefined) return parseMealPaidStatus(data.food);
    if (data.mealPaid !== undefined) return parseMealPaidStatus(data.mealPaid);
    if (data.available !== undefined) return parseMealPaidStatus(data.available);
    if (data.verified !== undefined) return parseMealPaidStatus(data.verified);
    if (data.valid !== undefined) return parseMealPaidStatus(data.valid);
    if (data.result !== undefined) return parseMealPaidStatus(data.result);

    if (data.status !== undefined) {
      const s = String(data.status).toLowerCase().trim();
      if (["paid", "success", "active", "approved", "yes", "true", "ok"].includes(s)) return true;
      if (["unpaid", "failed", "inactive", "rejected", "no", "false"].includes(s)) return false;
    }

    if (data.success !== undefined) return Boolean(data.success);
  }

  return false;
}

/**
 * Scans an offline or dynamic QR code from the hostel mess.
 * The QR code can be:
 * 1. A complete URL (e.g. https://api.saturnalia.in/api/v1/meals/verify?day=day1)
 * 2. A relative backend path (e.g. /meals/verify?meal=lunch)
 * 3. A JSON payload with an endpoint or URL
 * 4. An offline mess code/identifier (which falls back to /meals/verify?code=...)
 */
export async function verifyMealPassQR(
  qrData: string,
  user?: UserProfile | null
): Promise<MealVerificationResult> {
  const trimmed = qrData.trim();
  const now = new Date();
  const timestamp = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Built-in testing override shortcuts for quick manual verification
  if (trimmed === "test:paid" || trimmed === "test-paid" || trimmed.toLowerCase() === "demo:paid") {
    return {
      paid: true,
      statusText: "PAID",
      message: "Meal pass verified successfully (Test Demo)",
      day: "day1",
      timestamp,
    };
  }
  if (trimmed === "test:unpaid" || trimmed === "test-unpaid" || trimmed.toLowerCase() === "demo:unpaid") {
    return {
      paid: false,
      statusText: "NOT PAID",
      message: "No meal pass found (Test Demo)",
      day: "day1",
      timestamp,
    };
  }

  // 1. Determine target URL / endpoint
  let targetUrl = "";
  let isRelative = false;

  // Check if QR data is JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.url) {
        targetUrl = parsed.url;
      } else if (parsed.endpoint || parsed.path) {
        targetUrl = parsed.endpoint || parsed.path;
      } else {
        // If the QR directly encoded the result:
        const directPaid = parseMealPaidStatus(parsed);
        return {
          paid: directPaid,
          statusText: directPaid ? "PAID" : "NOT PAID",
          message: parsed.message || (directPaid ? "Meal pass verified" : "No active meal payment found"),
          day: parsed.day,
          timestamp,
          rawResponse: parsed,
        };
      }
    } catch {
      // Not JSON, continue
    }
  }

  if (!targetUrl) {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      targetUrl = trimmed;
    } else if (trimmed.startsWith("/")) {
      targetUrl = trimmed;
      isRelative = true;
    } else {
      // It's a code/token/plain string: query our backend verification endpoint
      targetUrl = `/meals/verify?code=${encodeURIComponent(trimmed)}`;
      isRelative = true;
    }
  }

  try {
    const token = await getIdTokenIfSignedIn();
    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;

    if (isRelative) {
      // Normalize path for apiFetch (ensure starts with / and remove duplicate /api/v1 if included)
      let cleanPath = targetUrl;
      if (cleanPath.startsWith("/api/v1")) {
        cleanPath = cleanPath.substring("/api/v1".length);
      }
      response = await apiFetch(cleanPath, { method: "GET", headers }, token ? "optional" : "none");
    } else {
      // Absolute URL
      response = await fetch(targetUrl, {
        method: "GET",
        headers,
      });

      // If GET gave 405 Method Not Allowed, retry with POST
      if (response.status === 405) {
        response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user?.userId,
            email: user?.email,
          }),
        });
      }
    }

    let responseData: any = null;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
    }

    const paid = parseMealPaidStatus(responseData);
    const message =
      (typeof responseData === "object" && responseData?.message) ||
      (paid ? "Meal pass verified successfully. Enjoy your meal!" : "No active meal pass found for this meal.");

    const day = (typeof responseData === "object" && responseData?.day) || undefined;

    return {
      paid,
      statusText: paid ? "PAID" : "NOT PAID",
      message,
      day,
      timestamp,
      rawResponse: responseData,
    };
  } catch (err: any) {
    console.warn("Meal pass QR verification request error:", err);

    // Fallback: If network is offline or server unreachable, check user's local booked food status
    if (user?.food && Object.values(user.food).some(Boolean)) {
      return {
        paid: true,
        statusText: "PAID (OFFLINE VERIFIED)",
        message: "Active food pass verified from your account record.",
        timestamp,
      };
    }

    return {
      paid: false,
      statusText: "NOT VERIFIED",
      message: err.message || "Could not verify QR code. Please check connection and try again.",
      timestamp,
    };
  }
}
