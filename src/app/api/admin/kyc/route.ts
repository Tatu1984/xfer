import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireRole,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/admin/kyc - List KYC verifications
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [verifications, total] = await Promise.all([
    prisma.kYCVerification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            createdAt: true,
            business: {
              select: { legalName: true, businessType: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.kYCVerification.count({ where }),
  ]);

  return successResponse({
    verifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// PATCH /api/admin/kyc - Update KYC status
const updateKycSchema = z.object({
  kycId: z.string(),
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional(),
  level: z.number().min(1).max(3).optional(),
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const { user: adminUser } = authResult;

  try {
    const body = await request.json();
    const data = updateKycSchema.parse(body);

    if (data.status === "REJECTED" && !data.rejectionReason) {
      return errorResponse("Rejection reason is required", 400);
    }

    const kyc = await prisma.kYCVerification.findUnique({
      where: { id: data.kycId },
      include: { user: true },
    });

    if (!kyc) {
      return errorResponse("KYC verification not found", 404);
    }

    const updateData: Record<string, unknown> = {
      status: data.status,
      verifiedBy: adminUser.id,
      verifiedAt: new Date(),
    };

    if (data.status === "REJECTED") {
      updateData.rejectionReason = data.rejectionReason;
    } else if (data.status === "APPROVED") {
      updateData.level = data.level || 2;
      updateData.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    }

    const updated = await prisma.kYCVerification.update({
      where: { id: data.kycId },
      data: updateData,
    });

    // If approved, activate user account
    if (data.status === "APPROVED" && kyc.user.status === "PENDING") {
      await prisma.user.update({
        where: { id: kyc.userId },
        data: { status: "ACTIVE" },
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: `kyc_${data.status.toLowerCase()}`,
        entityType: "kyc",
        entityId: data.kycId,
        details: {
          userId: kyc.userId,
          status: data.status,
          rejectionReason: data.rejectionReason,
        },
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: kyc.userId,
        type: "system",
        title:
          data.status === "APPROVED"
            ? "Identity Verification Approved"
            : "Identity Verification Rejected",
        message:
          data.status === "APPROVED"
            ? "Your identity has been verified. You now have full access to all features."
            : `Your identity verification was rejected. Reason: ${data.rejectionReason}`,
      },
    });

    return successResponse(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    return errorResponse("Failed to update KYC status", 500);
  }
}
