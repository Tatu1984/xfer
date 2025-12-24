import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface WebhookPayload {
  id: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  duration: number;
}

// Generate webhook signature
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: number,
  tolerance: number = 300 // 5 minutes
): boolean {
  // Check timestamp is within tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    return false;
  }

  const expectedSignature = generateWebhookSignature(payload, secret, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Deliver webhook to URL
async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  const timestamp = Math.floor(startTime / 1000);
  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, secret, timestamp);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": timestamp.toString(),
        "X-Webhook-Id": payload.id,
      },
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      return { success: true, statusCode: response.status, duration };
    }

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}

// Send webhook to all subscribers
export async function sendWebhook(
  eventType: string,
  data: Record<string, unknown>,
  businessId?: string
): Promise<void> {
  const webhookId = `whk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  const payload: WebhookPayload = {
    id: webhookId,
    type: eventType,
    createdAt: new Date().toISOString(),
    data,
  };

  // Find all active webhooks that are subscribed to this event type
  const where: Record<string, unknown> = {
    isActive: true,
    events: { has: eventType },
  };

  if (businessId) {
    where.businessId = businessId;
  }

  const webhooks = await prisma.webhook.findMany({ where });

  // Deliver to each webhook in parallel
  const deliveryPromises = webhooks.map(async (webhook) => {
    const result = await deliverWebhook(webhook.url, payload, webhook.secret);

    // Update webhook status
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        failureCount: result.success ? 0 : { increment: 1 },
      },
    });

    // If too many failures, disable the webhook
    if (!result.success) {
      const updated = await prisma.webhook.findUnique({
        where: { id: webhook.id },
      });
      if (updated && updated.failureCount >= 10) {
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { isActive: false },
        });
      }
    }

    return { webhookId: webhook.id, ...result };
  });

  await Promise.allSettled(deliveryPromises);
}

// Webhook event types
export const WebhookEvents = {
  // Transaction events
  TRANSACTION_CREATED: "transaction.created",
  TRANSACTION_COMPLETED: "transaction.completed",
  TRANSACTION_FAILED: "transaction.failed",
  TRANSACTION_REFUNDED: "transaction.refunded",

  // Order events
  ORDER_CREATED: "order.created",
  ORDER_AUTHORIZED: "order.authorized",
  ORDER_CAPTURED: "order.captured",
  ORDER_VOIDED: "order.voided",
  ORDER_REFUNDED: "order.refunded",

  // Payout events
  PAYOUT_CREATED: "payout.created",
  PAYOUT_COMPLETED: "payout.completed",
  PAYOUT_FAILED: "payout.failed",

  // Dispute events
  DISPUTE_CREATED: "dispute.created",
  DISPUTE_UPDATED: "dispute.updated",
  DISPUTE_RESOLVED: "dispute.resolved",

  // Subscription events
  SUBSCRIPTION_CREATED: "subscription.created",
  SUBSCRIPTION_UPDATED: "subscription.updated",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  SUBSCRIPTION_PAYMENT_FAILED: "subscription.payment_failed",

  // Invoice events
  INVOICE_CREATED: "invoice.created",
  INVOICE_PAID: "invoice.paid",
  INVOICE_OVERDUE: "invoice.overdue",

  // Customer events
  CUSTOMER_CREATED: "customer.created",
  CUSTOMER_UPDATED: "customer.updated",
} as const;

export type WebhookEventType = (typeof WebhookEvents)[keyof typeof WebhookEvents];

// Helper to trigger transaction webhooks
export async function triggerTransactionWebhook(
  transaction: {
    id: string;
    referenceId: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    senderId?: string | null;
    receiverId?: string | null;
    createdAt: Date;
  },
  eventType: WebhookEventType
): Promise<void> {
  await sendWebhook(eventType, {
    transactionId: transaction.id,
    referenceId: transaction.referenceId,
    type: transaction.type,
    status: transaction.status,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    timestamp: transaction.createdAt.toISOString(),
  });
}

// Helper to trigger order webhooks
export async function triggerOrderWebhook(
  order: {
    id: string;
    orderNumber: string;
    merchantId: string;
    status: string;
    total: number;
    currency: string;
    createdAt: Date;
  },
  eventType: WebhookEventType
): Promise<void> {
  await sendWebhook(
    eventType,
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      amount: Number(order.total),
      currency: order.currency,
      timestamp: order.createdAt.toISOString(),
    },
    order.merchantId
  );
}
