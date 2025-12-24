import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Calculate exponential backoff delay
function getRetryDelay(attemptCount: number): number {
  // Exponential backoff: 1min, 5min, 30min, 2hr, 12hr
  const delays = [60, 300, 1800, 7200, 43200];
  return delays[Math.min(attemptCount - 1, delays.length - 1)] * 1000;
}

// Generate webhook signature
export function generateWebhookSignature(payload: string, secret: string): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = 300 // 5 minutes
): boolean {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sig = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!timestamp || !sig) return false;

  // Check timestamp is within tolerance
  const ts = parseInt(timestamp);
  if (Date.now() - ts > tolerance * 1000) return false;

  // Verify signature
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}

// Queue webhook for delivery
export async function queueWebhookDelivery(
  webhookId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<string> {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
  });

  if (!webhook || !webhook.isActive) {
    throw new Error("Webhook not found or inactive");
  }

  if (!webhook.events.includes(eventType) && !webhook.events.includes("*")) {
    throw new Error("Webhook not subscribed to this event");
  }

  const payload: WebhookPayload = {
    event: eventType,
    data,
    timestamp: new Date().toISOString(),
  };

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId,
      eventType,
      payload: payload as object,
    },
  });

  // Attempt immediate delivery
  await attemptWebhookDelivery(delivery.id);

  return delivery.id;
}

// Attempt to deliver a webhook
export async function attemptWebhookDelivery(deliveryId: string): Promise<boolean> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery || delivery.status === "SUCCESS") {
    return true;
  }

  if (delivery.attemptCount >= delivery.maxAttempts) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", failureReason: "Max attempts exceeded" },
    });
    return false;
  }

  // Find webhook
  const webhook = await prisma.webhook.findUnique({
    where: { id: delivery.webhookId },
  });

  if (!webhook) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", failureReason: "Webhook not found" },
    });
    return false;
  }

  const payloadStr = JSON.stringify(delivery.payload);
  const signature = generateWebhookSignature(payloadStr, webhook.secret);

  const startTime = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Id": deliveryId,
        "User-Agent": "Xfer-Webhook/1.0",
      },
      body: payloadStr,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      // Success
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SUCCESS",
          attemptCount: { increment: 1 },
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 1000),
          responseTime,
          deliveredAt: new Date(),
        },
      });

      // Update webhook last triggered
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date(), failureCount: 0 },
      });

      return true;
    } else {
      // HTTP error
      throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const nextAttempt = delivery.attemptCount + 1;

    let nextRetryAt: Date | null = null;
    let status = "PENDING";

    if (nextAttempt >= delivery.maxAttempts) {
      status = "FAILED";
    } else {
      nextRetryAt = new Date(Date.now() + getRetryDelay(nextAttempt));
    }

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        attemptCount: nextAttempt,
        responseTime,
        failureReason: errorMessage,
        nextRetryAt,
      },
    });

    // Increment webhook failure count
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { failureCount: { increment: 1 } },
    });

    // Disable webhook if too many failures
    if (webhook.failureCount >= 10) {
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: { isActive: false },
      });

      // Notify business owner
      const business = await prisma.business.findUnique({
        where: { id: webhook.businessId },
      });

      if (business) {
        await prisma.notification.create({
          data: {
            userId: business.userId,
            type: "system",
            title: "Webhook Disabled",
            message: `Webhook ${webhook.url} has been disabled due to too many failures`,
            data: { webhookId: webhook.id },
          },
        });
      }
    }

    return false;
  }
}

// Process pending webhook retries
export async function processWebhookRetries(): Promise<number> {
  const pendingDeliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: new Date() },
    },
    take: 100,
  });

  let successCount = 0;

  for (const delivery of pendingDeliveries) {
    const success = await attemptWebhookDelivery(delivery.id);
    if (success) successCount++;
  }

  return successCount;
}

// Trigger webhooks for an event
export async function triggerWebhooks(
  businessId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<string[]> {
  const webhooks = await prisma.webhook.findMany({
    where: {
      businessId,
      isActive: true,
      OR: [
        { events: { has: eventType } },
        { events: { has: "*" } },
      ],
    },
  });

  const deliveryIds: string[] = [];

  for (const webhook of webhooks) {
    try {
      const deliveryId = await queueWebhookDelivery(webhook.id, eventType, data);
      deliveryIds.push(deliveryId);
    } catch (error) {
      console.error(`Failed to queue webhook ${webhook.id}:`, error);
    }
  }

  return deliveryIds;
}
