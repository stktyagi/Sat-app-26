import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { OffPayUssdModule } = NativeModules;

export type ActionEventPayload =
  | { type: 'PROGRESS'; stepIndex: number; total: number; label: string | null }
  | { type: 'FRAME'; text: string; isMenu: boolean; isTerminal: boolean; stepIndex: number }
  | { type: 'REPLY'; stepIndex: number }
  | { type: 'DONE'; resultText: string }
  | { type: 'ERROR'; message: string; resultText: string };

export interface ActionResult {
  success: boolean;
  resultText: string;
}

function assertAndroid() {
  if (Platform.OS !== 'android') {
    throw new Error(
      'OffPay USSD automation is Android-only (*99# / AccessibilityService are not available on iOS).'
    );
  }
}

const emitter = Platform.OS === 'android' ? new NativeEventEmitter(OffPayUssdModule) : null;

/**
 * Subscribe to step-by-step progress for the currently running action
 * (payViaUpi / checkBalance). Returns an unsubscribe function.
 */
export function onActionEvent(handler: (event: ActionEventPayload) => void): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener('OffPayActionEvent', handler);
  return () => sub.remove();
}

/** Whether the OffPay accessibility service is currently enabled by the user. */
export async function isAccessibilityServiceEnabled(): Promise<boolean> {
  assertAndroid();
  return OffPayUssdModule.isAccessibilityServiceEnabled();
}

/** Opens system Settings > Accessibility so the user can enable the service. */
export function openAccessibilitySettings(): void {
  assertAndroid();
  OffPayUssdModule.openAccessibilitySettings();
}

/** Whether "display over other apps" is granted (needed to hide the raw carrier dialog). */
export async function canDrawOverlays(): Promise<boolean> {
  assertAndroid();
  return OffPayUssdModule.canDrawOverlays();
}

/** Opens system Settings > Display over other apps for this app. */
export function openOverlaySettings(): void {
  assertAndroid();
  OffPayUssdModule.openOverlaySettings();
}

/**
 * Runs the full *99*1*3# send-money flow (VPA -> amount -> note -> PIN ->
 * confirm). Resolves once the carrier reports success or failure — listen
 * to onActionEvent for intermediate step progress in the meantime.
 */
export async function payViaUpi(params: {
  vpa: string;
  amount: string;
  note?: string;
  pin: string;
}): Promise<ActionResult> {
  assertAndroid();
  return OffPayUssdModule.payViaUpi(params.vpa, params.amount, params.note ?? '', params.pin);
}

/** Runs the *99*3# balance-check flow. */
export async function checkBalance(pin: string): Promise<ActionResult> {
  assertAndroid();
  return OffPayUssdModule.checkBalance(pin);
}

/** Cancels whichever payViaUpi/checkBalance run is currently in progress. */
export async function cancelAction(): Promise<boolean> {
  assertAndroid();
  return OffPayUssdModule.cancelAction();
}

// ─── Low-level, for custom USSD flows beyond pay/balance ───────────────────

export async function dial(code: string): Promise<void> {
  assertAndroid();
  return OffPayUssdModule.dial(code);
}

export async function sendReply(reply: string): Promise<boolean> {
  assertAndroid();
  return OffPayUssdModule.sendReply(reply);
}

export async function cancelSession(): Promise<void> {
  assertAndroid();
  return OffPayUssdModule.cancelSession();
}
