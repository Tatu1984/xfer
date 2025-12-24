import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const user = await prisma.user.findUnique({
      where: { id: authResult.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        status: true,
        mfaEnabled: true,
        emailVerified: true,
        phoneVerified: true,
        locale: true,
        timezone: true,
        preferredCurrency: true,
        createdAt: true,
        kycVerification: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!user) {
      return errorResponse("User not found", 404);
    }

    return successResponse({
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        kycStatus: user.kycVerification?.status || "NOT_STARTED",
        mfaEnabled: user.mfaEnabled,
        emailVerified: !!user.emailVerified,
        phoneVerified: !!user.phoneVerified,
        locale: user.locale,
        timezone: user.timezone,
        preferredCurrency: user.preferredCurrency,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return errorResponse("Failed to fetch profile", 500);
  }
}

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  phone: z.string().max(20).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  preferredCurrency: z.string().length(3).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.displayName !== undefined) updateData.displayName = validated.displayName;
    if (validated.firstName !== undefined) updateData.firstName = validated.firstName;
    if (validated.lastName !== undefined) updateData.lastName = validated.lastName;
    if (validated.phone !== undefined) updateData.phone = validated.phone;
    if (validated.locale !== undefined) updateData.locale = validated.locale;
    if (validated.timezone !== undefined) updateData.timezone = validated.timezone;
    if (validated.preferredCurrency !== undefined) updateData.preferredCurrency = validated.preferredCurrency;

    const user = await prisma.user.update({
      where: { id: authResult.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        phone: true,
        locale: true,
        timezone: true,
        preferredCurrency: true,
      },
    });

    return successResponse({ profile: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Update profile error:", error);
    return errorResponse("Failed to update profile", 500);
  }
}
