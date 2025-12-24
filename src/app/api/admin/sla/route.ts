import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const slaPolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  firstResponseTime: z.number().min(1).max(10080), // Max 1 week in minutes
  resolutionTime: z.number().min(1).max(43200), // Max 30 days in minutes
  escalateAfter: z.number().optional(),
  escalateTo: z.string().optional(),
  isActive: z.boolean().default(true),
});

// GET - List SLA policies and breaches
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "policies";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (view === "policies") {
      // Get SLA policies
      const policies = await prisma.sLAPolicy.findMany({
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      });

      return NextResponse.json({ policies });
    }

    if (view === "breaches") {
      // Get SLA breaches
      const ticketId = searchParams.get("ticketId");
      const breachType = searchParams.get("type");

      const where: Record<string, unknown> = {};
      if (ticketId) where.ticketId = ticketId;
      if (breachType) where.breachType = breachType;

      const [breaches, total] = await Promise.all([
        prisma.sLABreach.findMany({
          where,
          orderBy: { breachedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.sLABreach.count({ where }),
      ]);

      return NextResponse.json({
        breaches,
        pagination: { total, limit, offset, hasMore: offset + breaches.length < total },
      });
    }

    if (view === "metrics") {
      // Get SLA performance metrics
      const periodDays = parseInt(searchParams.get("days") || "30");
      const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      const [totalTickets, breachedTickets, byType] = await Promise.all([
        prisma.supportTicket.count({
          where: { createdAt: { gte: startDate } },
        }),
        prisma.sLABreach.groupBy({
          by: ["ticketId"],
          where: { breachedAt: { gte: startDate } },
        }),
        prisma.sLABreach.groupBy({
          by: ["breachType"],
          where: { breachedAt: { gte: startDate } },
          _count: true,
        }),
      ]);

      const breachRate = totalTickets > 0 ? (breachedTickets.length / totalTickets) * 100 : 0;

      return NextResponse.json({
        metrics: {
          period: { days: periodDays, startDate },
          totalTickets,
          ticketsWithBreaches: breachedTickets.length,
          breachRate: Math.round(breachRate * 100) / 100,
          breachesByType: byType.map((b) => ({
            type: b.breachType,
            count: b._count,
          })),
        },
      });
    }

    return NextResponse.json({ error: "Invalid view parameter" }, { status: 400 });
  } catch (error) {
    console.error("Get SLA data error:", error);
    return NextResponse.json({ error: "Failed to fetch SLA data" }, { status: 500 });
  }
}

// POST - Create SLA policy
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const data = slaPolicySchema.parse(body);

    // Check for existing policy with same name
    const existing = await prisma.sLAPolicy.findFirst({
      where: {
        name: data.name,
        isActive: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Active policy already exists with this name" },
        { status: 409 }
      );
    }

    const policy = await prisma.sLAPolicy.create({
      data,
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create SLA policy error:", error);
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 });
  }
}

// PATCH - Update SLA policy
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Policy ID required" }, { status: 400 });
    }

    const policy = await prisma.sLAPolicy.findUnique({
      where: { id },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const validUpdates: Record<string, unknown> = {};
    if (updates.name) validUpdates.name = updates.name;
    if (updates.description !== undefined) validUpdates.description = updates.description;
    if (updates.priority) validUpdates.priority = updates.priority;
    if (updates.firstResponseTime) validUpdates.firstResponseTime = updates.firstResponseTime;
    if (updates.resolutionTime) validUpdates.resolutionTime = updates.resolutionTime;
    if (updates.escalateAfter !== undefined) validUpdates.escalateAfter = updates.escalateAfter;
    if (updates.escalateTo !== undefined) validUpdates.escalateTo = updates.escalateTo;
    if (updates.isActive !== undefined) validUpdates.isActive = updates.isActive;

    const updated = await prisma.sLAPolicy.update({
      where: { id },
      data: validUpdates,
    });

    return NextResponse.json({ policy: updated });
  } catch (error) {
    console.error("Update SLA policy error:", error);
    return NextResponse.json({ error: "Failed to update policy" }, { status: 500 });
  }
}

// DELETE - Delete SLA policy
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Policy ID required" }, { status: 400 });
    }

    // Check if policy has breaches
    const breachCount = await prisma.sLABreach.count({
      where: { policyId: id },
    });

    if (breachCount > 0) {
      // Soft delete by deactivating
      await prisma.sLAPolicy.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: "Policy deactivated (has breach history)" });
    }

    await prisma.sLAPolicy.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete SLA policy error:", error);
    return NextResponse.json({ error: "Failed to delete policy" }, { status: 500 });
  }
}
