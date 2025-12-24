import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { WebhookEvents } from "@/lib/webhooks";

// GET /api/webhooks - List business webhooks
export async function GET() {
  const authResult = await requireRole(["VENDOR"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const webhooks = await prisma.webhook.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        lastTriggeredAt: true,
        failureCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      webhooks,
      availableEvents: Object.values(WebhookEvents),
    });
  } catch (error) {
    console.error("Get webhooks error:", error);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

// POST /api/webhooks - Create webhook
const createWebhookSchema = z.object({
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.string()).min(1, "At least one event is required"),
});

export async function POST(request: NextRequest) {
  const authResult = await requireRole(["VENDOR"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { url, events } = createWebhookSchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Limit webhooks per business
    const existingCount = await prisma.webhook.count({
      where: { businessId: business.id },
    });

    if (existingCount >= 5) {
      return NextResponse.json(
        { error: "Maximum of 5 webhooks allowed" },
        { status: 400 }
      );
    }

    // Generate secret
    const secret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

    const webhook = await prisma.webhook.create({
      data: {
        businessId: business.id,
        url,
        events,
        secret,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "webhook_created",
        entityType: "webhook",
        entityId: webhook.id,
        details: { url, events },
      },
    });

    return NextResponse.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret, // Only returned once
      message: "Save this secret now. You won't be able to see it again.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Create webhook error:", error);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}

// PATCH /api/webhooks - Update webhook
const updateWebhookSchema = z.object({
  id: z.string(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireRole(["VENDOR"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { id, ...updates } = updateWebhookSchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Verify ownership
    const webhook = await prisma.webhook.findFirst({
      where: { id, businessId: business.id },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const updated = await prisma.webhook.update({
      where: { id },
      data: {
        ...updates,
        // Reset failure count if re-enabling
        ...(updates.isActive === true ? { failureCount: 0 } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      url: updated.url,
      events: updated.events,
      isActive: updated.isActive,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Update webhook error:", error);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

// DELETE /api/webhooks - Delete webhook
export async function DELETE(request: NextRequest) {
  const authResult = await requireRole(["VENDOR"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Webhook ID is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Verify ownership
    const webhook = await prisma.webhook.findFirst({
      where: { id, businessId: business.id },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.webhook.delete({ where: { id } });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "webhook_deleted",
        entityType: "webhook",
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete webhook error:", error);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}
