import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const kybSchema = z.object({
  legalName: z.string().min(1),
  tradingName: z.string().optional(),
  registrationNumber: z.string().min(1),
  taxId: z.string().optional(),
  businessType: z.enum(["sole_proprietor", "llc", "corporation", "partnership", "nonprofit"]),
  industry: z.string().min(1),
  mcc: z.string().optional(),
  website: z.string().url().optional(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  supportEmail: z.string().email(),
  supportPhone: z.string().optional(),
  description: z.string().optional(),
  beneficialOwners: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    dateOfBirth: z.string(),
    ownershipPercentage: z.number().min(0).max(100),
    address: z.object({
      line1: z.string(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      country: z.string(),
    }),
    documentType: z.string().optional(),
    documentUrl: z.string().optional(),
  })).optional(),
});

// GET - Get business verification status
export async function GET() {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({
        status: "NOT_STARTED",
        message: "Business verification not started",
      });
    }

    return NextResponse.json({
      id: business.id,
      status: business.kybStatus,
      legalName: business.legalName,
      tradingName: business.tradingName,
      businessType: business.businessType,
      industry: business.industry,
      verifiedAt: business.verifiedAt,
      rejectionReason: business.rejectionReason,
    });
  } catch (error) {
    console.error("Get KYB status error:", error);
    return NextResponse.json({ error: "Failed to fetch KYB status" }, { status: 500 });
  }
}

// POST - Submit KYB verification
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const data = kybSchema.parse(body);

    // Check if already submitted
    const existing = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (existing && existing.kybStatus === "APPROVED") {
      return NextResponse.json(
        { error: "Business already verified" },
        { status: 400 }
      );
    }

    const business = await prisma.business.upsert({
      where: { userId: authResult.id },
      create: {
        userId: authResult.id,
        kybStatus: "PENDING",
        legalName: data.legalName,
        tradingName: data.tradingName,
        registrationNumber: data.registrationNumber,
        taxId: data.taxId,
        businessType: data.businessType,
        industry: data.industry,
        mcc: data.mcc,
        website: data.website,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        description: data.description,
        beneficialOwners: data.beneficialOwners || [],
      },
      update: {
        kybStatus: "PENDING",
        legalName: data.legalName,
        tradingName: data.tradingName,
        registrationNumber: data.registrationNumber,
        taxId: data.taxId,
        businessType: data.businessType,
        industry: data.industry,
        mcc: data.mcc,
        website: data.website,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        description: data.description,
        beneficialOwners: data.beneficialOwners || [],
        rejectionReason: null,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: authResult.id,
        action: "kyb_submitted",
        entityType: "business",
        entityId: business.id,
        details: {
          legalName: data.legalName,
          businessType: data.businessType,
        },
      },
    });

    // Create notification for admins
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "system",
        title: "New KYB Verification",
        message: `${data.legalName} has submitted KYB verification`,
        data: { businessId: business.id },
      })),
    });

    return NextResponse.json({
      success: true,
      status: "PENDING",
      message: "Business verification submitted for review",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Submit KYB error:", error);
    return NextResponse.json({ error: "Failed to submit KYB" }, { status: 500 });
  }
}

// PUT - Update KYB documents
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { registrationDocUrl, taxDocUrl } = body;

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        registrationDocUrl: registrationDocUrl || business.registrationDocUrl,
        taxDocUrl: taxDocUrl || business.taxDocUrl,
        kybStatus: business.kybStatus === "REJECTED" ? "PENDING" : business.kybStatus,
      },
    });

    return NextResponse.json({
      success: true,
      status: updated.kybStatus,
    });
  } catch (error) {
    console.error("Update KYB docs error:", error);
    return NextResponse.json({ error: "Failed to update documents" }, { status: 500 });
  }
}
