/**
 * Port of OffPay's UpiParser.kt. Pure string parsing, no native code
 * needed — works with whatever QR-scanning library hands you the raw
 * decoded string (upi:// URIs and plain VPA text alike).
 */

export interface UpiData {
  vpa: string;
  payeeName?: string;
  amount?: string;
  transactionNote?: string;
}

// Same pattern as UpiParser.kt's VPA_REGEX.
const VPA_REGEX = /[a-zA-Z0-9.\-_]{3,}@[a-zA-Z0-9.\-_]{3,}/;
const VPA_REGEX_FULL = /^[a-zA-Z0-9.\-_]{3,}@[a-zA-Z0-9.\-_]{3,}$/;

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function parseQueryParams(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).toLowerCase();
    const value = pair.slice(idx + 1);
    out[key] = value;
  }
  return out;
}

/** Validates whether a string is a plausible VPA (e.g. "stall123@okhdfcbank"). */
export function isValidVpa(vpa: string): boolean {
  return VPA_REGEX_FULL.test(vpa.trim());
}

/**
 * Parses a `upi://pay?...` QR payload (the standard NPCI/BharatQR UPI
 * intent format most vendor QR codes use). Returns null if it isn't a
 * upi:// URI or has no valid `pa` (payee address) param.
 */
export function parseUpiUri(raw: string): UpiData | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith('upi://pay?')) return null;

  const queryString = trimmed.split('?')[1] ?? '';
  if (!queryString) return null;

  const params = parseQueryParams(queryString);
  const vpaRaw = params['pa'];
  if (!vpaRaw) return null;

  const vpa = decodeParam(vpaRaw);
  if (!isValidVpa(vpa)) return null;

  return {
    vpa,
    payeeName: params['pn'] ? decodeParam(params['pn']) : undefined,
    amount: params['am'] ? decodeParam(params['am']) : undefined,
    transactionNote: params['tn'] ? decodeParam(params['tn']) : undefined,
  };
}

/** Pulls the first VPA-looking substring out of arbitrary scanned text. */
export function extractVpaFromText(text: string): string | null {
  const match = text.match(VPA_REGEX);
  return match ? match[0] : null;
}

/**
 * Best-effort parse for whatever a QR scan hands back: tries the standard
 * upi:// URI first, then falls back to pulling a bare VPA out of the text
 * (some vendor printouts are just the VPA as plain text/a static QR).
 */
export function parseScannedPayload(raw: string): UpiData | null {
  const viaUri = parseUpiUri(raw);
  if (viaUri) return viaUri;

  const bareVpa = extractVpaFromText(raw);
  if (bareVpa) return { vpa: bareVpa };

  return null;
}
