import { Platform, NativeModules, TurboModuleRegistry } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export interface EasebuzzCheckoutOptions {
  accessKey?: string;
  payMode?: string; // 'test' | 'production'
  paymentUrl: string;
  merchantOrderId: string;
}

export interface EasebuzzCheckoutResult {
  type: 'sdk' | 'browser';
  status: 'completed' | 'cancelled' | 'error';
  rawResponse?: any;
  error?: any;
}

/**
 * Checks if the Easebuzz native SDK is linked and available on the current device.
 */
export function isEasebuzzSdkAvailable(): boolean {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }
  try {
    const isTurboModuleEnabled = (globalThis as any)?.__turboModuleProxy != null;
    if (isTurboModuleEnabled && typeof TurboModuleRegistry?.get === 'function') {
      const module = TurboModuleRegistry.get('EasebuzzSdk');
      if (module) return true;
    }
    return Boolean(NativeModules?.EasebuzzSdk);
  } catch {
    return false;
  }
}

/**
 * Initiates the payment checkout using Easebuzz SDK when available,
 * falling back gracefully to the WebBrowser authentication session.
 */
export async function startEasebuzzPayment(
  options: EasebuzzCheckoutOptions
): Promise<EasebuzzCheckoutResult> {
  const { accessKey, payMode = 'test', paymentUrl, merchantOrderId } = options;

  // 1. Handle dummy payments directly if enabled on backend
  if (paymentUrl.includes('/payments/dummy')) {
    try {
      await fetch(paymentUrl, { headers: { Accept: 'application/json' } });
      return { type: 'browser', status: 'completed' };
    } catch {
      // If direct fetch fails, proceed with browser fallback below
    }
  }

  // 2. If native Easebuzz SDK is available and accessKey is provided, use the SDK
  if (accessKey && isEasebuzzSdkAvailable()) {
    try {
      // Lazy import so environments without the native module (like Web or Expo Go) don't crash on import
      const { initializeEasebuzzCheckout } = require('react-native-easebuzz-sdk');
      const response = await initializeEasebuzzCheckout(accessKey, payMode);

      let parsed: any = response;
      if (typeof response === 'string') {
        try {
          parsed = JSON.parse(response);
        } catch {
          parsed = { result: response };
        }
      }

      const resultStr = String(parsed?.result || '').toLowerCase();
      if (resultStr.includes('cancel') || resultStr.includes('dismiss')) {
        return {
          type: 'sdk',
          status: 'cancelled',
          rawResponse: parsed,
        };
      }

      return {
        type: 'sdk',
        status: 'completed',
        rawResponse: parsed,
      };
    } catch (err: any) {
      const errMsg = String(err?.message || err?.code || err || '').toLowerCase();
      const isDismissed =
        errMsg.includes('dismiss') ||
        errMsg.includes('cancel') ||
        errMsg.includes('payment_dismissed');

      if (isDismissed) {
        return {
          type: 'sdk',
          status: 'cancelled',
          error: err,
        };
      }

      console.warn('[Easebuzz] Native SDK error, falling back to WebBrowser:', err);
      // Fall through to browser fallback if native invocation failed unexpectedly
    }
  }

  // 3. Fallback to WebBrowser (in-app browser modal)
  try {
    const redirectUrl = 'app://payment';
    const browserResult = await WebBrowser.openAuthSessionAsync(paymentUrl, redirectUrl);

    if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
      return {
        type: 'browser',
        status: 'cancelled',
        rawResponse: browserResult,
      };
    }

    return {
      type: 'browser',
      status: 'completed',
      rawResponse: browserResult,
    };
  } catch (err) {
    return {
      type: 'browser',
      status: 'error',
      error: err,
    };
  }
}
