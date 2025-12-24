import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const updateAlertSchema = z.object({
  id: z.string(),
  action: z.enum(["review", "resolve", "escalate", "dismiss"]),
  notes: z.string().optional(),
});

// GET - List compliance alerts
export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "SUPER_ADMIN"]);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (severity && severity !== "all") {
      where.severity = severity.toUpperCase();
    }

    const [alerts, total] = await Promise.all([
      prisma.complianceAlert.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: [
          { status: "asc" },
          { severity: "desc" },
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.complianceAlert.count({ where }),
    ]);

    // Get counts by status (using AlertStatus enum values)
    const [newCount, investigatingCount, resolvedCount, highCount] = await Promise.all([
      prisma.complianceAlert.count({ where: { status: "NEW" } }),
      prisma.complianceAlert.count({ where: { status: "INVESTIGATING" } }),
      prisma.complianceAlert.count({ where: { status: "RESOLVED" } }),
      prisma.complianceAlert.count({ where: { severity: "HIGH", status: { not: "RESOLVED" } } }),
    ]);

    return NextResponse.json({
      alerts,
      summary: {
        pending: newCount,
        reviewing: investigatingCount,
        resolved: resolvedCount,
        highSeverity: highCount,
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + alerts.length < total,
      },
    });
  } catch (error) {
    console.error("Get compliance alerts error:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

// PATCH - Update alert status
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string };
    const body = await request.json();
    const data = updateAlertSchema.parse(body);

    const alert = await prisma.complianceAlert.findUnique({
      where: { id: data.id },
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};
    let activityAction = "";

    switch (data.action) {
      case "review":
        updateData = {
          status: "INVESTIGATING",
          assignedTo: user.id,
        };
        activityAction = "COMPLIANCE_ALERT_INVESTIGATING";
        break;

      case "resolve":
        updateData = {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: user.id,
          resolution: data.notes || alert.resolution,
        };
        activityAction = "COMPLIANCE_ALERT_RESOLVED";
        break;

      case "escalate":
        updateData = {
          status: "ESCALATED",
          severity: "CRITICAL",
          resolution: data.notes ? `${alert.resolution || ""}\nEscalated: ${data.notes}` : alert.resolution,
        };
        activityAction = "COMPLIANCE_ALERT_ESCALATED";
        break;

      case "dismiss":
        updateData = {
          status: "FALSE_POSITIVE",
          resolvedAt: new Date(),
          resolvedBy: user.id,
          resolution: data.notes ? `${alert.resolution || ""}\nDismissed: ${data.notes}` : alert.resolution,
        };
        activityAction = "COMPLIANCE_ALERT_DISMISSED";
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.complianceAlert.update({
      where: { id: data.id },
      data: updateData,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: activityAction,
        entityType: "COMPLIANCE_ALERT",
        entityId: data.id,
        details: { action: data.action, notes: data.notes },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Update compliance alert error:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
