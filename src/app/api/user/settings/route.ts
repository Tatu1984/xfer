import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

const profileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  country: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

const notificationSchema = z.object({
  transactionAlerts: z.boolean().optional(),
  paymentReceived: z.boolean().optional(),
  paymentSent: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  soundAlerts: z.boolean().optional(),
});

const preferencesSchema = z.object({
  language: z.string().optional(),
  timezone: z.string().optional(),
  preferredCurrency: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const securitySchema = z.object({
  mfaEnabled: z.boolean().optional(),
});

// GET - Get user settings
export async function GET() {
  try {
    const authResult = await requireAuth();

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        country: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        timezone: true,
        preferredCurrency: true,
        mfaEnabled: true,
        notificationPreferences: true,
        createdAt: true,
      },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Default notification preferences
    const defaultNotifications = {
      transactionAlerts: true,
      paymentReceived: true,
      paymentSent: true,
      weeklySummary: false,
      marketingEmails: false,
      pushNotifications: true,
      soundAlerts: true,
    };

    const notifications = {
      ...defaultNotifications,
      ...(userData.notificationPreferences as Record<string, boolean> || {}),
    };

    return NextResponse.json({
      profile: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        dateOfBirth: userData.dateOfBirth?.toISOString().split("T")[0] || null,
        country: userData.country,
        addressLine1: userData.addressLine1,
        addressLine2: userData.addressLine2,
        city: userData.city,
        state: userData.state,
        postalCode: userData.postalCode,
      },
      notifications,
      preferences: {
        language: "en",
        timezone: userData.timezone || "EST",
        preferredCurrency: userData.preferredCurrency || "USD",
      },
      security: {
        mfaEnabled: userData.mfaEnabled || false,
      },
    });
  } catch (error) {
    console.error("Get user settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PATCH - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const { section, data } = body;

    if (!section || !data) {
      return NextResponse.json({ error: "Section and data are required" }, { status: 400 });
    }

    switch (section) {
      case "profile": {
        const validatedData = profileSchema.parse(data);
        const updateData: Record<string, unknown> = { ...validatedData };

        if (validatedData.dateOfBirth) {
          updateData.dateOfBirth = new Date(validatedData.dateOfBirth);
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });

        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: "PROFILE_UPDATED",
            entityType: "USER",
            entityId: user.id,
            details: { updatedFields: Object.keys(validatedData) },
          },
        });

        return NextResponse.json({ success: true, message: "Profile updated successfully" });
      }

      case "notifications": {
        const validatedData = notificationSchema.parse(data);

        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { notificationPreferences: true },
        });

        const currentPrefs = (existingUser?.notificationPreferences as Record<string, boolean>) || {};
        const mergedPrefs = { ...currentPrefs, ...validatedData };

        await prisma.user.update({
          where: { id: user.id },
          data: { notificationPreferences: mergedPrefs },
        });

        return NextResponse.json({ success: true, message: "Notification preferences updated" });
      }

      case "preferences": {
        const validatedData = preferencesSchema.parse(data);

        await prisma.user.update({
          where: { id: user.id },
          data: validatedData,
        });

        return NextResponse.json({ success: true, message: "Preferences updated" });
      }

      case "password": {
        const validatedData = passwordSchema.parse(data);

        const userData = await prisma.user.findUnique({
          where: { id: user.id },
          select: { passwordHash: true },
        });

        if (!userData?.passwordHash) {
          return NextResponse.json({ error: "Cannot change password for OAuth accounts" }, { status: 400 });
        }

        const isValid = await bcrypt.compare(validatedData.currentPassword, userData.passwordHash);
        if (!isValid) {
          return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
        }

        const newPasswordHash = await bcrypt.hash(validatedData.newPassword, 12);

        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: newPasswordHash },
        });

        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: "PASSWORD_CHANGED",
            entityType: "USER",
            entityId: user.id,
          },
        });

        return NextResponse.json({ success: true, message: "Password updated successfully" });
      }

      case "security": {
        const validatedData = securitySchema.parse(data);

        await prisma.user.update({
          where: { id: user.id },
          data: validatedData,
        });

        if (validatedData.mfaEnabled !== undefined) {
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              action: validatedData.mfaEnabled ? "MFA_ENABLED" : "MFA_DISABLED",
              entityType: "USER",
              entityId: user.id,
            },
          });
        }

        return NextResponse.json({ success: true, message: "Security settings updated" });
      }

      default:
        return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Update user settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
