import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth-utils";
import { createSARReport, getComplianceStats, SUSPICIOUS_PATTERNS } from "@/lib/compliance";
import { prisma } from "@/lib/prisma";

// GET /api/compliance/reports - Get compliance reports and stats
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'stats', 'alerts', 'reports'

    if (type === "stats") {
      const stats = await getComplianceStats();
      return NextResponse.json(stats);
    }

    if (type === "reports") {
      const reports = await prisma.complianceAlert.findMany({
        where: { alertType: "SAR_REPORT" },
        include: {
          user: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return NextResponse.json({ reports });
    }

    // Default: get new alerts
    const alerts = await prisma.complianceAlert.findMany({
      where: { status: "NEW" },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({
      alerts,
      patterns: SUSPICIOUS_PATTERNS,
    });
  } catch (error) {
    console.error("Get compliance reports error:", error);
    return NextResponse.json(
      { error: "Failed to fetch compliance data" },
      { status: 500 }
    );
  }
}

// POST /api/compliance/reports - Create SAR report
const createReportSchema = z.object({
  userId: z.string(),
  alertIds: z.array(z.string()),
  transactionIds: z.array(z.string()),
  narrative: z.string().min(100, "Narrative must be at least 100 characters"),
  suspiciousIndicators: z.array(z.string()).min(1, "At least one indicator required"),
});

export async function POST(request: NextRequest) {
  const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const data = createReportSchema.parse(body);

    const reportId = await createSARReport(
      data.userId,
      data.alertIds,
      data.transactionIds,
      data.narrative,
      data.suspiciousIndicators,
      user.id
    );

    return NextResponse.json({
      success: true,
      reportId,
      message: "SAR report created successfully",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Create SAR report error:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}

// PATCH /api/compliance/reports - Update alert status
const updateAlertSchema = z.object({
  alertId: z.string(),
  status: z.enum(["NEW", "INVESTIGATING", "ESCALATED", "RESOLVED", "FALSE_POSITIVE"]),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string; email: string };

  try {
    const body = await request.json();
    const { alertId, status, notes } = updateAlertSchema.parse(body);

    const alert = await prisma.complianceAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    await prisma.complianceAlert.update({
      where: { id: alertId },
      data: {
        status,
        resolvedAt: status !== "NEW" ? new Date() : null,
        resolvedBy: status !== "NEW" ? user.id : null,
        details: {
          ...(typeof alert.details === "object" && alert.details !== null ? alert.details : {}),
          notes,
          reviewedAt: new Date().toISOString(),
          reviewedBy: user.email,
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: `compliance_alert_${status.toLowerCase()}`,
        entityType: "compliance_alert",
        entityId: alertId,
        details: { status, notes },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Alert ${status.toLowerCase()}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Update alert error:", error);
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}
