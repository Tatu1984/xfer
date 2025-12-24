import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const platformSettingsSchema = z.object({
  platformName: z.string().optional(),
  supportEmail: z.string().email().optional(),
  defaultCurrency: z.string().optional(),
  defaultTimezone: z.string().optional(),
  maintenanceMode: z.boolean().optional(),
  newUserRegistrations: z.boolean().optional(),
});

const transactionLimitsSchema = z.object({
  dailyTransferLimitUnverified: z.number().min(0).optional(),
  dailyTransferLimitVerified: z.number().min(0).optional(),
  singleTransactionLimit: z.number().min(0).optional(),
  monthlyTransactionLimit: z.number().min(0).optional(),
});

const securitySettingsSchema = z.object({
  require2FAForAdmins: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().min(5).max(240).optional(),
  ipWhitelisting: z.boolean().optional(),
  failedLoginLockout: z.boolean().optional(),
  maxFailedLoginAttempts: z.number().min(3).max(10).optional(),
  lockoutDurationMinutes: z.number().min(5).max(60).optional(),
});

const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  slackIntegration: z.boolean().optional(),
  slackWebhookUrl: z.string().url().optional().or(z.literal("")),
});

// GET - Get system settings
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    // Get system settings from database or return defaults
    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      // Create default settings
      settings = await prisma.systemSettings.create({
        data: {
          platformName: "Xfer",
          supportEmail: "support@xfer.com",
          defaultCurrency: "USD",
          defaultTimezone: "UTC",
          maintenanceMode: false,
          newUserRegistrations: true,
          dailyTransferLimitUnverified: 500,
          dailyTransferLimitVerified: 10000,
          singleTransactionLimit: 5000,
          monthlyTransactionLimit: 50000,
          require2FAForAdmins: true,
          sessionTimeoutMinutes: 30,
          ipWhitelisting: false,
          failedLoginLockout: true,
          maxFailedLoginAttempts: 5,
          lockoutDurationMinutes: 15,
          emailNotifications: true,
          smsNotifications: false,
          slackIntegration: false,
        },
      });
    }

    return NextResponse.json({
      platform: {
        platformName: settings.platformName,
        supportEmail: settings.supportEmail,
        defaultCurrency: settings.defaultCurrency,
        defaultTimezone: settings.defaultTimezone,
        maintenanceMode: settings.maintenanceMode,
        newUserRegistrations: settings.newUserRegistrations,
      },
      transactionLimits: {
        dailyTransferLimitUnverified: settings.dailyTransferLimitUnverified,
        dailyTransferLimitVerified: settings.dailyTransferLimitVerified,
        singleTransactionLimit: settings.singleTransactionLimit,
        monthlyTransactionLimit: settings.monthlyTransactionLimit,
      },
      security: {
        require2FAForAdmins: settings.require2FAForAdmins,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
        ipWhitelisting: settings.ipWhitelisting,
        failedLoginLockout: settings.failedLoginLockout,
        maxFailedLoginAttempts: settings.maxFailedLoginAttempts,
        lockoutDurationMinutes: settings.lockoutDurationMinutes,
      },
      notifications: {
        emailNotifications: settings.emailNotifications,
        smsNotifications: settings.smsNotifications,
        slackIntegration: settings.slackIntegration,
        slackWebhookUrl: settings.slackWebhookUrl || "",
      },
    });
  } catch (error) {
    console.error("Get system settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PATCH - Update system settings
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);

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

    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {},
      });
    }

    let updateData: Record<string, unknown> = {};
    let sectionName = "";

    switch (section) {
      case "platform": {
        const validatedData = platformSettingsSchema.parse(data);
        updateData = validatedData;
        sectionName = "Platform Settings";
        break;
      }

      case "transactionLimits": {
        const validatedData = transactionLimitsSchema.parse(data);
        updateData = validatedData;
        sectionName = "Transaction Limits";
        break;
      }

      case "security": {
        const validatedData = securitySettingsSchema.parse(data);
        updateData = validatedData;
        sectionName = "Security Settings";
        break;
      }

      case "notifications": {
        const validatedData = notificationSettingsSchema.parse(data);
        updateData = validatedData;
        sectionName = "Notification Settings";
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }

    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: updateData,
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "SYSTEM_SETTINGS_UPDATED",
        entityType: "SYSTEM",
        entityId: settings.id,
        details: { section: sectionName, updatedFields: Object.keys(data) },
      },
    });

    return NextResponse.json({ success: true, message: `${sectionName} updated successfully` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Update system settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
