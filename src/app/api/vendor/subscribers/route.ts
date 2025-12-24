import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

// GET - List vendor's subscribers
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const planId = searchParams.get("planId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const business = await prisma.business.findUnique({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Get all plan IDs for this business
    const plans = await prisma.subscriptionPlan.findMany({
      where: { businessId: business.id },
      select: { id: true },
    });
    const planIds = plans.map((p) => p.id);

    const where: Record<string, unknown> = {
      planId: { in: planIds },
    };

    if (planId) {
      where.planId = planId;
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          plan: {
            select: { id: true, name: true, price: true, currency: true, interval: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.subscription.count({ where }),
    ]);

    // Calculate stats
    const activeCount = await prisma.subscription.count({
      where: { ...where, status: "ACTIVE" },
    });

    const mrr = subscriptions
      .filter((s) => s.status === "ACTIVE")
      .reduce((sum, s) => sum + Number(s.plan.price), 0);

    // Calculate churn (cancelled in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const cancelledCount = await prisma.subscription.count({
      where: {
        planId: { in: planIds },
        status: "CANCELLED",
        updatedAt: { gte: thirtyDaysAgo },
      },
    });
    const churnRate = total > 0 ? ((cancelledCount / total) * 100).toFixed(1) : "0";

    return NextResponse.json({
      subscribers: subscriptions,
      stats: {
        total,
        active: activeCount,
        mrr,
        churnRate: `${churnRate}%`,
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + subscriptions.length < total,
      },
    });
  } catch (error) {
    console.error("Get subscribers error:", error);
    return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
  }
}

// PATCH - Update subscription (cancel, pause, resume)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.id;

    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Subscription ID and action are required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id },
      include: { plan: true },
    });

    if (!subscription || subscription.plan.businessId !== business.id) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "cancel":
        if (subscription.status === "CANCELLED") {
          return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
        }
        updateData = {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelAtPeriodEnd: true,
        };
        break;

      case "pause":
        if (subscription.status !== "ACTIVE") {
          return NextResponse.json({ error: "Can only pause active subscriptions" }, { status: 400 });
        }
        updateData = { status: "PAUSED" };
        break;

      case "resume":
        if (subscription.status !== "PAUSED") {
          return NextResponse.json({ error: "Can only resume paused subscriptions" }, { status: 400 });
        }
        updateData = { status: "ACTIVE" };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        plan: { select: { id: true, name: true, price: true, currency: true, interval: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update subscription error:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
