import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/kyc - Get user's KYC status
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };

  const kyc = await prisma.kYCVerification.findUnique({
    where: { userId: user.id },
  });

  if (!kyc) {
    return successResponse({
      status: "NOT_STARTED",
      level: 0,
      steps: {
        identity: { completed: false, status: "NOT_STARTED" },
        address: { completed: false, status: "NOT_STARTED" },
        selfie: { completed: false, status: "NOT_STARTED" },
      },
      message: "Identity verification not started",
    });
  }

  // Determine step completion status
  const identityCompleted = !!(kyc.documentType && kyc.documentFrontUrl);
  const addressCompleted = !!(kyc.addressLine1 && kyc.city && kyc.addressProofUrl);
  const selfieCompleted = !!kyc.selfieUrl;

  // Determine individual step statuses
  const getStepStatus = (completed: boolean, overallStatus: string) => {
    if (completed) {
      if (overallStatus === "APPROVED") return "APPROVED";
      if (overallStatus === "REJECTED") return "REJECTED";
      return "PENDING";
    }
    return "NOT_STARTED";
  };

  return successResponse({
    id: kyc.id,
    status: kyc.status,
    level: kyc.level,
    steps: {
      identity: {
        completed: identityCompleted,
        status: getStepStatus(identityCompleted, kyc.status),
      },
      address: {
        completed: addressCompleted,
        status: getStepStatus(addressCompleted, kyc.status),
      },
      selfie: {
        completed: selfieCompleted,
        status: getStepStatus(selfieCompleted, kyc.status),
      },
    },
    verification: {
      id: kyc.id,
      status: kyc.status,
      submittedAt: kyc.createdAt.toISOString(),
      notes: kyc.rejectionReason || undefined,
    },
    documentType: kyc.documentType,
    addressVerified: kyc.addressVerified,
    verifiedAt: kyc.verifiedAt,
    expiresAt: kyc.expiresAt,
    rejectionReason: kyc.rejectionReason,
    sanctionsChecked: kyc.sanctionsChecked,
    pepChecked: kyc.pepChecked,
  });
}

// POST /api/kyc - Submit KYC verification
const submitKycSchema = z.object({
  step: z.enum(["identity", "address", "selfie"]),
  // Identity step
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  documentCountry: z.string().optional(),
  documentFrontUrl: z.string().optional(),
  documentBackUrl: z.string().optional(),
  documentExpiryDate: z.string().optional(),
  // Address step
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  addressProofUrl: z.string().optional(),
  // Selfie step
  selfieUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const data = submitKycSchema.parse(body);

    // Get or create KYC record
    let kyc = await prisma.kYCVerification.findUnique({
      where: { userId: user.id },
    });

    if (!kyc) {
      kyc = await prisma.kYCVerification.create({
        data: {
          userId: user.id,
          status: "PENDING",
        },
      });
    }

    // Check if already approved
    if (kyc.status === "APPROVED") {
      return errorResponse("KYC already approved", 400);
    }

    // Update based on step
    const updateData: Record<string, unknown> = {
      status: "PENDING",
    };

    if (data.step === "identity") {
      if (!data.documentType || !data.documentNumber || !data.documentFrontUrl) {
        return errorResponse("Document details required", 400);
      }
      updateData.documentType = data.documentType;
      updateData.documentNumber = data.documentNumber;
      updateData.documentCountry = data.documentCountry;
      updateData.documentFrontUrl = data.documentFrontUrl;
      updateData.documentBackUrl = data.documentBackUrl;
      if (data.documentExpiryDate) {
        updateData.documentExpiryDate = new Date(data.documentExpiryDate);
      }
    } else if (data.step === "address") {
      if (!data.addressLine1 || !data.city || !data.country) {
        return errorResponse("Address details required", 400);
      }
      updateData.addressLine1 = data.addressLine1;
      updateData.addressLine2 = data.addressLine2;
      updateData.city = data.city;
      updateData.state = data.state;
      updateData.postalCode = data.postalCode;
      updateData.country = data.country;
      updateData.addressProofUrl = data.addressProofUrl;
    } else if (data.step === "selfie") {
      if (!data.selfieUrl) {
        return errorResponse("Selfie required", 400);
      }
      updateData.selfieUrl = data.selfieUrl;
      // Mark as ready for review
      updateData.status = "IN_REVIEW";
    }

    const updated = await prisma.kYCVerification.update({
      where: { id: kyc.id },
      data: updateData,
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: `kyc_${data.step}_submitted`,
        entityType: "kyc",
        entityId: kyc.id,
        details: { step: data.step },
      },
    });

    return successResponse({
      id: updated.id,
      status: updated.status,
      step: data.step,
      message:
        data.step === "selfie"
          ? "Verification submitted. We will review your documents within 24-48 hours."
          : "Step completed. Please continue with the next step.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("KYC submission error:", error);
    return errorResponse("Failed to submit verification", 500);
  }
}
