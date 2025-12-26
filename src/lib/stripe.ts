import Stripe from "stripe";

// Initialize Stripe client - will be null if no API key configured
const stripe = process.env.STRIPE_SECRET_KEY?.startsWith("sk_")
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    })
  : null;

// Check if Stripe is configured
export function isStripeConfigured(): boolean {
  return stripe !== null;
}

// ============================================
// TYPES
// ============================================

export interface CreatePaymentIntentOptions {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  metadata?: Record<string, string>;
  description?: string;
  captureMethod?: "automatic" | "manual";
  receiptEmail?: string;
}

export interface CreateCustomerOptions {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentMethodOptions {
  type: "card" | "us_bank_account";
  card?: {
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  status?: string;
  error?: string;
  requiresAction?: boolean;
  actionUrl?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status?: string;
  error?: string;
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

export async function createCustomer(
  options: CreateCustomerOptions
): Promise<{ success: boolean; customerId?: string; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create customer:", options.email);
    return { success: true, customerId: `cus_dev_${Date.now()}` };
  }

  try {
    const customer = await stripe.customers.create({
      email: options.email,
      name: options.name,
      phone: options.phone,
      metadata: options.metadata,
    });

    return { success: true, customerId: customer.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe] Failed to create customer:", message);
    return { success: false, error: message };
  }
}

export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer | null> {
  if (!stripe) {
    return null;
  }

  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.deleted ? null : (customer as Stripe.Customer);
  } catch {
    return null;
  }
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<CreateCustomerOptions>
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would update customer:", customerId);
    return { success: true };
  }

  try {
    await stripe.customers.update(customerId, {
      email: updates.email,
      name: updates.name,
      phone: updates.phone,
      metadata: updates.metadata,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================
// PAYMENT INTENTS
// ============================================

export async function createPaymentIntent(
  options: CreatePaymentIntentOptions
): Promise<PaymentResult> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create payment intent:", {
      amount: options.amount,
      currency: options.currency,
    });
    return {
      success: true,
      paymentIntentId: `pi_dev_${Date.now()}`,
      clientSecret: `pi_dev_${Date.now()}_secret_dev`,
      status: "requires_payment_method",
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: options.amount,
      currency: options.currency.toLowerCase(),
      customer: options.customerId,
      payment_method: options.paymentMethodId,
      metadata: options.metadata,
      description: options.description,
      capture_method: options.captureMethod || "automatic",
      receipt_email: options.receiptEmail,
      confirm: !!options.paymentMethodId,
      automatic_payment_methods: options.paymentMethodId
        ? undefined
        : { enabled: true },
    });

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      status: paymentIntent.status,
      requiresAction: paymentIntent.status === "requires_action",
      actionUrl: paymentIntent.next_action?.redirect_to_url?.url ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe] Failed to create payment intent:", message);
    return { success: false, error: message };
  }
}

export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<PaymentResult> {
  if (!stripe) {
    console.log("[Stripe Dev] Would confirm payment intent:", paymentIntentId);
    return {
      success: true,
      paymentIntentId,
      status: "succeeded",
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    return {
      success: paymentIntent.status === "succeeded",
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      requiresAction: paymentIntent.status === "requires_action",
      actionUrl: paymentIntent.next_action?.redirect_to_url?.url ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function capturePaymentIntent(
  paymentIntentId: string,
  amountToCapture?: number
): Promise<PaymentResult> {
  if (!stripe) {
    console.log("[Stripe Dev] Would capture payment intent:", paymentIntentId);
    return {
      success: true,
      paymentIntentId,
      status: "succeeded",
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: amountToCapture,
    });

    return {
      success: paymentIntent.status === "succeeded",
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<PaymentResult> {
  if (!stripe) {
    console.log("[Stripe Dev] Would cancel payment intent:", paymentIntentId);
    return {
      success: true,
      paymentIntentId,
      status: "canceled",
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent | null> {
  if (!stripe) {
    return null;
  }

  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return null;
  }
}

// ============================================
// REFUNDS
// ============================================

export async function createRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: "duplicate" | "fraudulent" | "requested_by_customer"
): Promise<RefundResult> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create refund for:", paymentIntentId);
    return {
      success: true,
      refundId: `re_dev_${Date.now()}`,
      status: "succeeded",
    };
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount,
      reason,
    });

    return {
      success: refund.status === "succeeded",
      refundId: refund.id,
      status: refund.status ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe] Failed to create refund:", message);
    return { success: false, error: message };
  }
}

// ============================================
// PAYMENT METHODS
// ============================================

export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would attach payment method:", paymentMethodId);
    return { success: true };
  }

  try {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would detach payment method:", paymentMethodId);
    return { success: true };
  }

  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function listPaymentMethods(
  customerId: string,
  type: Stripe.PaymentMethodListParams.Type = "card"
): Promise<Stripe.PaymentMethod[]> {
  if (!stripe) {
    return [];
  }

  try {
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type,
    });
    return methods.data;
  } catch {
    return [];
  }
}

// ============================================
// SETUP INTENTS (for saving cards)
// ============================================

export async function createSetupIntent(
  customerId: string
): Promise<{ success: boolean; clientSecret?: string; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create setup intent for:", customerId);
    return {
      success: true,
      clientSecret: `seti_dev_${Date.now()}_secret_dev`,
    };
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
    });

    return {
      success: true,
      clientSecret: setupIntent.client_secret || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================
// PAYOUTS
// ============================================

export async function createPayout(
  amount: number,
  currency: string,
  destination?: string,
  metadata?: Record<string, string>
): Promise<{ success: boolean; payoutId?: string; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create payout:", { amount, currency });
    return { success: true, payoutId: `po_dev_${Date.now()}` };
  }

  try {
    const payout = await stripe.payouts.create({
      amount,
      currency: currency.toLowerCase(),
      destination,
      metadata,
    });

    return { success: true, payoutId: payout.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe] Failed to create payout:", message);
    return { success: false, error: message };
  }
}

// ============================================
// TRANSFERS (for Connect platforms)
// ============================================

export async function createTransfer(
  amount: number,
  currency: string,
  destinationAccountId: string,
  metadata?: Record<string, string>
): Promise<{ success: boolean; transferId?: string; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create transfer:", {
      amount,
      destinationAccountId,
    });
    return { success: true, transferId: `tr_dev_${Date.now()}` };
  }

  try {
    const transfer = await stripe.transfers.create({
      amount,
      currency: currency.toLowerCase(),
      destination: destinationAccountId,
      metadata,
    });

    return { success: true, transferId: transfer.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe] Failed to create transfer:", message);
    return { success: false, error: message };
  }
}

// ============================================
// WEBHOOKS
// ============================================

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("[Stripe] Webhook signature verification failed:", error);
    return null;
  }
}

// Webhook event handlers
export type StripeEventHandler = (event: Stripe.Event) => Promise<void>;

const eventHandlers: Map<string, StripeEventHandler[]> = new Map();

export function onStripeEvent(
  eventType: string,
  handler: StripeEventHandler
): void {
  const handlers = eventHandlers.get(eventType) || [];
  handlers.push(handler);
  eventHandlers.set(eventType, handlers);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const handlers = eventHandlers.get(event.type) || [];
  const wildcardHandlers = eventHandlers.get("*") || [];

  for (const handler of [...handlers, ...wildcardHandlers]) {
    try {
      await handler(event);
    } catch (error) {
      console.error(`[Stripe] Error handling ${event.type}:`, error);
    }
  }
}

// ============================================
// SUBSCRIPTIONS
// ============================================

export async function createSubscription(
  customerId: string,
  priceId: string,
  options?: {
    trialPeriodDays?: number;
    metadata?: Record<string, string>;
    defaultPaymentMethod?: string;
  }
): Promise<{
  success: boolean;
  subscriptionId?: string;
  status?: string;
  error?: string;
}> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create subscription:", {
      customerId,
      priceId,
    });
    return {
      success: true,
      subscriptionId: `sub_dev_${Date.now()}`,
    };
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: options?.trialPeriodDays,
      metadata: options?.metadata,
      default_payment_method: options?.defaultPaymentMethod,
      payment_behavior: "default_incomplete",
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe] Failed to create subscription:", message);
    return { success: false, error: message };
  }
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would cancel subscription:", subscriptionId);
    return { success: true };
  }

  try {
    if (cancelAtPeriodEnd) {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(subscriptionId);
    }
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================
// PRODUCTS & PRICES
// ============================================

export async function createProduct(
  name: string,
  description?: string,
  metadata?: Record<string, string>
): Promise<{ success: boolean; productId?: string; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create product:", name);
    return { success: true, productId: `prod_dev_${Date.now()}` };
  }

  try {
    const product = await stripe.products.create({
      name,
      description,
      metadata,
    });
    return { success: true, productId: product.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function createPrice(
  productId: string,
  unitAmount: number,
  currency: string,
  recurring?: { interval: "day" | "week" | "month" | "year"; intervalCount?: number }
): Promise<{ success: boolean; priceId?: string; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create price:", { productId, unitAmount });
    return { success: true, priceId: `price_dev_${Date.now()}` };
  }

  try {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency: currency.toLowerCase(),
      recurring: recurring
        ? {
            interval: recurring.interval,
            interval_count: recurring.intervalCount || 1,
          }
        : undefined,
    });
    return { success: true, priceId: price.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ============================================
// CHECKOUT SESSIONS
// ============================================

export async function createCheckoutSession(options: {
  customerId?: string;
  customerEmail?: string;
  lineItems: { priceId: string; quantity: number }[];
  mode: "payment" | "subscription" | "setup";
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ success: boolean; sessionId?: string; url?: string; error?: string }> {
  if (!stripe) {
    console.log("[Stripe Dev] Would create checkout session");
    return {
      success: true,
      sessionId: `cs_dev_${Date.now()}`,
      url: options.successUrl,
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: options.customerId,
      customer_email: options.customerId ? undefined : options.customerEmail,
      line_items: options.lineItems.map((item) => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      mode: options.mode,
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      metadata: options.metadata,
    });

    return {
      success: true,
      sessionId: session.id,
      url: session.url || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe] Failed to create checkout session:", message);
    return { success: false, error: message };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatAmountForStripe(amount: number, currency: string): number {
  // Stripe expects amounts in the smallest currency unit (cents for USD)
  const zeroDecimalCurrencies = [
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ];

  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return Math.round(amount);
  }

  return Math.round(amount * 100);
}

export function formatAmountFromStripe(amount: number, currency: string): number {
  const zeroDecimalCurrencies = [
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ];

  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return amount;
  }

  return amount / 100;
}

// Export the raw Stripe instance for advanced usage
export { stripe };
