import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const planSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  currency: z.string().default("USD"),
  interval: z.enum(["day", "week", "month", "year"]),
  intervalCount: z.number().int().positive().default(1),
  trialDays: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

// GET - List vendor's subscription plans
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const where: Record<string, unknown> = {
      businessId: business.id,
    };

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where,
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate revenue per plan
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const activeSubscriptions = await prisma.subscription.count({
          where: { planId: plan.id, status: "ACTIVE" },
        });
        const monthlyRevenue = activeSubscriptions * Number(plan.price);
        return {
          ...plan,
          activeSubscribers: activeSubscriptions,
          monthlyRevenue,
        };
      })
    );

    return NextResponse.json({
      plans: plansWithStats,
      summary: {
        totalPlans: plans.length,
        activePlans: plans.filter((p) => p.isActive).length,
        totalSubscribers: plansWithStats.reduce((sum, p) => sum + p.activeSubscribers, 0),
        totalMRR: plansWithStats.reduce((sum, p) => sum + p.monthlyRevenue, 0),
      },
    });
  } catch (error) {
    console.error("Get plans error:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

// POST - Create a new subscription plan
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const data = planSchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        ...data,
        businessId: business.id,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create plan error:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}

// PATCH - Update a subscription plan
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id, businessId: business.id },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}

// DELETE - Delete a subscription plan (only if no active subscribers)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id, businessId: business.id },
      include: {
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (plan._count.subscriptions > 0) {
      return NextResponse.json(
        { error: "Cannot delete plan with active subscribers. Deactivate it instead." },
        { status: 400 }
      );
    }

    await prisma.subscriptionPlan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete plan error:", error);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
