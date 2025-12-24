import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

const webhookSchema = z.object({
  url: z.string().url().startsWith("https://"),
  events: z.array(z.string()).min(1),
});

// Valid webhook events
const VALID_EVENTS = [
  "*", // All events
  "payment.created",
  "payment.completed",
  "payment.failed",
  "payment.refunded",
  "transfer.created",
  "transfer.completed",
  "transfer.failed",
  "dispute.created",
  "dispute.updated",
  "dispute.resolved",
  "payout.created",
  "payout.completed",
  "payout.failed",
  "customer.created",
  "customer.updated",
  "subscription.created",
  "subscription.cancelled",
  "invoice.created",
  "invoice.paid",
  "invoice.failed",
];

// GET - List webhooks and deliveries
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const webhookId = searchParams.get("webhookId");
    const view = searchParams.get("view") || "webhooks";

    // Verify business ownership
    if (!businessId) {
      return NextResponse.json({ error: "Business ID required" }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (view === "deliveries" && webhookId) {
      // Get delivery logs
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const [deliveries, total] = await Promise.all([
        prisma.webhookDelivery.findMany({
          where: { webhookId },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.webhookDelivery.count({ where: { webhookId } }),
      ]);

      return NextResponse.json({
        deliveries: deliveries.map((d) => ({
          id: d.id,
          eventType: d.eventType,
          status: d.status,
          attemptCount: d.attemptCount,
          responseStatus: d.responseStatus,
          responseTime: d.responseTime,
          failureReason: d.failureReason,
          createdAt: d.createdAt,
          deliveredAt: d.deliveredAt,
        })),
        pagination: { total, limit, offset, hasMore: offset + deliveries.length < total },
      });
    }

    if (view === "events") {
      // Return available events
      return NextResponse.json({ events: VALID_EVENTS });
    }

    // Get webhooks
    const webhooks = await prisma.webhook.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    });

    // Get recent delivery stats
    const stats = await Promise.all(
      webhooks.map(async (webhook) => {
        const [total, success, failed] = await Promise.all([
          prisma.webhookDelivery.count({ where: { webhookId: webhook.id } }),
          prisma.webhookDelivery.count({ where: { webhookId: webhook.id, status: "SUCCESS" } }),
          prisma.webhookDelivery.count({ where: { webhookId: webhook.id, status: "FAILED" } }),
        ]);
        return { webhookId: webhook.id, total, success, failed };
      })
    );

    return NextResponse.json({
      webhooks: webhooks.map((w) => {
        const stat = stats.find((s) => s.webhookId === w.id);
        return {
          id: w.id,
          url: w.url,
          events: w.events,
          isActive: w.isActive,
          failureCount: w.failureCount,
          lastTriggeredAt: w.lastTriggeredAt,
          createdAt: w.createdAt,
          stats: stat,
        };
      }),
    });
  } catch (error) {
    console.error("Get webhooks error:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

// POST - Create webhook
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { businessId, ...data } = body;

    if (!businessId) {
      return NextResponse.json({ error: "Business ID required" }, { status: 400 });
    }

    // Verify business ownership
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const validatedData = webhookSchema.parse(data);

    // Validate events
    const invalidEvents = validatedData.events.filter((e) => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString("hex");

    // Check webhook limit (max 10 per business)
    const webhookCount = await prisma.webhook.count({ where: { businessId } });
    if (webhookCount >= 10) {
      return NextResponse.json(
        { error: "Maximum webhook limit reached (10)" },
        { status: 400 }
      );
    }

    const webhook = await prisma.webhook.create({
      data: {
        businessId,
        url: validatedData.url,
        events: validatedData.events,
        secret,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret, // Only shown on creation
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
        },
        message: "Save the secret! It won't be shown again.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create webhook error:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}

// PATCH - Update webhook
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { id, url, events, isActive, regenerateSecret } = body;

    if (!id) {
      return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
    }

    // Find webhook and verify ownership
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook || webhook.business.userId !== user.id) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (url) {
      if (!url.startsWith("https://")) {
        return NextResponse.json({ error: "URL must use HTTPS" }, { status: 400 });
      }
      updateData.url = url;
    }

    if (events) {
      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `Invalid events: ${invalidEvents.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.events = events;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
      if (isActive) {
        // Reset failure count when re-enabling
        updateData.failureCount = 0;
      }
    }

    let newSecret: string | undefined;
    if (regenerateSecret) {
      newSecret = crypto.randomBytes(32).toString("hex");
      updateData.secret = newSecret;
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data: updateData,
    });

    const response: Record<string, unknown> = {
      webhook: {
        id: updated.id,
        url: updated.url,
        events: updated.events,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      },
    };

    if (newSecret) {
      response.newSecret = newSecret;
      response.message = "Save the new secret! It won't be shown again.";
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Update webhook error:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

// DELETE - Delete webhook
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
    }

    // Find webhook and verify ownership
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook || webhook.business.userId !== user.id) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Delete deliveries first
    await prisma.webhookDelivery.deleteMany({
      where: { webhookId: id },
    });

    await prisma.webhook.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete webhook error:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}

// PUT - Test webhook (send test event)
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { id, eventType } = body;

    if (!id) {
      return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });
    }

    // Find webhook and verify ownership
    const webhook = await prisma.webhook.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!webhook || webhook.business.userId !== user.id) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    if (!webhook.isActive) {
      return NextResponse.json({ error: "Webhook is not active" }, { status: 400 });
    }

    // Send test event
    const testPayload = {
      event: eventType || "test.webhook",
      data: {
        id: `test_${Date.now()}`,
        message: "This is a test webhook event",
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    const payloadStr = JSON.stringify(testPayload);
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(`${timestamp}.${payloadStr}`)
      .digest("hex");

    const startTime = Date.now();

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `t=${timestamp},v1=${signature}`,
          "X-Webhook-Id": "test",
          "User-Agent": "Xfer-Webhook/1.0",
        },
        body: payloadStr,
        signal: AbortSignal.timeout(10000),
      });

      const responseTime = Date.now() - startTime;
      const responseBody = await response.text().catch(() => "");

      return NextResponse.json({
        success: response.ok,
        statusCode: response.status,
        responseTime,
        responseBody: responseBody.slice(0, 500),
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
        responseTime: Date.now() - startTime,
      });
    }
  } catch (error) {
    console.error("Test webhook error:", error);
    return NextResponse.json({ error: "Failed to test webhook" }, { status: 500 });
  }
}
