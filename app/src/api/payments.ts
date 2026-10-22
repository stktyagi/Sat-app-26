import { apiFetch, readError } from "./client";

export interface Payment {
  id: string;
  merchantOrderId: string;
  userId: string;
  eventId: string;
  teamId: string;
  paymentType: string;
  originalAmount: number;
  transactionFees: number;
  finalAmount: number;
  status: "pending" | "success" | "failure";
  createdAt: string;
  completedAt?: string;
  processedIntentions: {
    eventRegistration?: {
      eventId: string;
      eventType: string;
      teamId: string;
      teamName: string;
      amount: number;
    } | null;
    accommodation: any | null;
    food: any | null;
  };
  couponCode?: string;
  discountAmount?: number;
}

export interface InitiatePaymentResponse {
  paymentUrl: string;
  merchantOrderId: string;
  accessKey?: string;
  payMode?: string;
}

/**
 * Initiate a payment for an event. Returns the Easebuzz checkout URL
 * that should be opened in a WebView.
 */
export interface PaymentOptions {
  eventId?: string;
  teamId?: string;
  paymentType?: string;
  couponCode?: string;
  accommodation?: Record<string, boolean>;
  food?: Record<string, boolean>;
}

export async function initiateEventPayment(options: PaymentOptions): Promise<InitiatePaymentResponse> {
  const body: Record<string, any> = {};
  if (options.eventId) body.eventId = options.eventId;
  if (options.teamId) body.teamId = options.teamId;
  if (options.paymentType) body.paymentType = options.paymentType;
  if (options.couponCode) body.couponCode = options.couponCode;
  if (options.accommodation) body.accommodation = options.accommodation;
  if (options.food) body.food = options.food;

  const response = await apiFetch(
    "/payments/initiate",
    { method: "POST", body: JSON.stringify(body) },
    "required"
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to initiate payment"));
  }
  return response.json();
}

export interface CouponResponse {
  code: string;
  description: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minCartValue: number;
}

/**
 * Validates a coupon code.
 */
export async function validateCoupon(
  couponCode: string,
  eventId: string
): Promise<CouponResponse> {
  const body = { couponCode, eventId };
  const response = await apiFetch(
    "/coupons/validate",
    { method: "POST", body: JSON.stringify(body) },
    "required"
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Invalid coupon"));
  }
  return response.json();
}

/**
 * Poll the payment status by merchantOrderId. Used after the WebView
 * returns to check if payment completed.
 */
export async function getPaymentStatus(
  merchantOrderId: string
): Promise<Payment> {
  const response = await apiFetch(
    `/payments/${merchantOrderId}`,
    {},
    "required"
  );
  if (!response.ok) {
    throw new Error(await readError(response, "Failed to fetch payment status"));
  }
  const data = await response.json();
  return data.payment;
}
