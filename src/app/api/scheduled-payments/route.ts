import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-utils";

const scheduledPaymentSchema = z.object({
  recipientEmail: z.string().email(),
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  note: z.string().optional(),
  frequency: z.enum(["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  maxRuns: z.number().positive().optional(),
});

// Calculate next run date based on frequency
function calculateNextRunDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);
  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      return next;
  }
  return next;
}

// GET - List scheduled payments
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;

    const scheduledPayments = await prisma.scheduledPayment.findMany({
      where,
      include: {
        _count: { select: { executions: true } },
      },
      orderBy: { nextRunDate: "asc" },
    });

    return NextResponse.json({ scheduledPayments });
  } catch (error) {
    console.error("Get scheduled payments error:", error);
    return NextResponse.json({ error: "Failed to fetch scheduled payments" }, { status: 500 });
  }
}

// POST - Create scheduled payment
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const data = scheduledPaymentSchema.parse(body);

    // Find recipient
    const recipient = await prisma.user.findUnique({
      where: { email: data.recipientEmail },
      select: { id: true },
    });

    // Check wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: { userId: user.id, currency: data.currency, isActive: true },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: `No ${data.currency} wallet found` },
        { status: 404 }
      );
    }

    const startDate = new Date(data.startDate);

    const scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        userId: user.id,
        recipientId: recipient?.id,
        recipientEmail: data.recipientEmail,
        amount: data.amount,
        currency: data.currency,
        note: data.note,
        frequency: data.frequency,
        nextRunDate: startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        maxRuns: data.maxRuns,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "scheduled_payment_created",
        entityType: "scheduled_payment",
        entityId: scheduledPayment.id,
        details: {
          recipientEmail: data.recipientEmail,
          amount: data.amount,
          frequency: data.frequency,
        },
      },
    });

    return NextResponse.json({
      success: true,
      scheduledPayment,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create scheduled payment error:", error);
    return NextResponse.json({ error: "Failed to create scheduled payment" }, { status: 500 });
  }
}

// PATCH - Update scheduled payment (pause, resume, cancel)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: "ID and action required" },
        { status: 400 }
      );
    }

    const scheduledPayment = await prisma.scheduledPayment.findFirst({
      where: { id, userId: user.id },
    });

    if (!scheduledPayment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "pause":
        if (scheduledPayment.status !== "ACTIVE") {
          return NextResponse.json({ error: "Can only pause active payments" }, { status: 400 });
        }
        updateData = { status: "PAUSED" };
        break;

      case "resume":
        if (scheduledPayment.status !== "PAUSED") {
          return NextResponse.json({ error: "Can only resume paused payments" }, { status: 400 });
        }
        // Recalculate next run date if it's in the past
        let nextRun = scheduledPayment.nextRunDate;
        while (nextRun < new Date()) {
          nextRun = calculateNextRunDate(nextRun, scheduledPayment.frequency);
        }
        updateData = { status: "ACTIVE", nextRunDate: nextRun };
        break;

      case "cancel":
        if (scheduledPayment.status === "CANCELLED" || scheduledPayment.status === "COMPLETED") {
          return NextResponse.json({ error: "Already cancelled or completed" }, { status: 400 });
        }
        updateData = { status: "CANCELLED" };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.scheduledPayment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, scheduledPayment: updated });
  } catch (error) {
    console.error("Update scheduled payment error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
