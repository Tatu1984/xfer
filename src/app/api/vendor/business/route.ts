import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const businessSchema = z.object({
  legalName: z.string().min(1).optional(),
  tradingName: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

// GET - Get vendor's business profile
export async function GET() {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error) {
    console.error("Get business error:", error);
    return NextResponse.json({ error: "Failed to fetch business" }, { status: 500 });
  }
}

// PATCH - Update business profile
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const data = businessSchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...data,
        website: data.website || null,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "BUSINESS_PROFILE_UPDATED",
        entityType: "BUSINESS",
        entityId: business.id,
        details: { updatedFields: Object.keys(data) },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Update business error:", error);
    return NextResponse.json({ error: "Failed to update business" }, { status: 500 });
  }
}
