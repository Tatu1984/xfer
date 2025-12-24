import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const settingsSchema = z.object({
  // General settings
  timezone: z.string().optional(),
  currency: z.string().optional(),
  statementDescriptor: z.string().max(22).optional(),

  // Notification settings
  orderNotifications: z.boolean().optional(),
  payoutNotifications: z.boolean().optional(),
  weeklyReports: z.boolean().optional(),
  marketingUpdates: z.boolean().optional(),

  // Payment settings
  payoutSchedule: z.enum(["daily", "weekly", "monthly", "manual"]).optional(),
  minimumPayoutAmount: z.number().min(0).optional(),
  automaticRefunds: z.boolean().optional(),
  automaticRefundThreshold: z.number().min(0).optional(),

  // Security settings
  twoFactorEnabled: z.boolean().optional(),
  loginNotifications: z.boolean().optional(),
});

// GET - Get vendor settings
export async function GET() {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.id;

    const business = await prisma.business.findUnique({
      where: { userId },
      select: {
        id: true,
        settings: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Get user preferences for security settings
    const userSettings = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        timezone: true,
        preferredCurrency: true,
        mfaEnabled: true,
      },
    });

    // Default settings
    const defaultSettings = {
      timezone: userSettings?.timezone || "UTC",
      currency: userSettings?.preferredCurrency || "USD",
      statementDescriptor: "",
      orderNotifications: true,
      payoutNotifications: true,
      weeklyReports: false,
      marketingUpdates: false,
      payoutSchedule: "weekly",
      minimumPayoutAmount: 100,
      automaticRefunds: false,
      automaticRefundThreshold: 50,
      twoFactorEnabled: userSettings?.mfaEnabled || false,
      loginNotifications: true,
    };

    // Merge with stored settings
    const storedSettings = (business.settings as Record<string, unknown>) || {};
    const settings = { ...defaultSettings, ...storedSettings };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PATCH - Update vendor settings
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const userId = authResult.id;
    const body = await request.json();
    const data = settingsSchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { userId },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Separate user-level settings from business settings
    const userUpdates: Record<string, unknown> = {};
    const businessSettings: Record<string, unknown> = {};

    if (data.timezone !== undefined) {
      userUpdates.timezone = data.timezone;
    }
    if (data.currency !== undefined) {
      userUpdates.preferredCurrency = data.currency;
    }
    if (data.twoFactorEnabled !== undefined) {
      userUpdates.mfaEnabled = data.twoFactorEnabled;
    }

    // All other settings go to business
    const businessKeys = [
      "statementDescriptor",
      "orderNotifications",
      "payoutNotifications",
      "weeklyReports",
      "marketingUpdates",
      "payoutSchedule",
      "minimumPayoutAmount",
      "automaticRefunds",
      "automaticRefundThreshold",
      "loginNotifications",
    ];

    businessKeys.forEach((key) => {
      if (data[key as keyof typeof data] !== undefined) {
        businessSettings[key] = data[key as keyof typeof data];
      }
    });

    // Update user if there are user-level changes
    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdates,
      });
    }

    // Merge with existing business settings
    const existingSettings = (business.settings as Record<string, unknown>) || {};
    const mergedSettings = { ...existingSettings, ...businessSettings };

    // Update business settings
    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { settings: mergedSettings as object },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: "settings_updated",
        entityType: "business",
        entityId: business.id,
        details: { updatedFields: Object.keys(data) },
      },
    });

    return NextResponse.json({
      success: true,
      settings: { ...mergedSettings, ...userUpdates },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
