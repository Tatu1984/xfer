import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-utils";

const gdprRequestSchema = z.object({
  requestType: z.enum(["export", "delete", "rectify", "restrict"]),
  requestDetails: z.record(z.string(), z.unknown()).optional(),
  deletionScope: z.array(z.string()).optional(),
});

// GET - Get user's GDPR requests
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const requests = await prisma.gDPRRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Get GDPR requests error:", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

// POST - Create GDPR request
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const data = gdprRequestSchema.parse(body);

    // Check for pending request of same type
    const pending = await prisma.gDPRRequest.findFirst({
      where: {
        userId: user.id,
        requestType: data.requestType,
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });

    if (pending) {
      return NextResponse.json(
        { error: "You already have a pending request of this type" },
        { status: 400 }
      );
    }

    const gdprRequest = await prisma.gDPRRequest.create({
      data: {
        userId: user.id,
        requestType: data.requestType,
        requestDetails: data.requestDetails as object | undefined,
        deletionScope: data.deletionScope || [],
      },
    });

    // For export requests, start processing immediately
    if (data.requestType === "export") {
      // In production, queue this for background processing
      // For now, we'll generate the export synchronously
      await processExportRequest(gdprRequest.id, user.id);
    }

    // Notify admins for deletion/restriction requests
    if (data.requestType === "delete" || data.requestType === "restrict") {
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
      });

      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "system",
          title: `GDPR ${data.requestType.toUpperCase()} Request`,
          message: `New GDPR ${data.requestType} request requires review`,
          data: { requestId: gdprRequest.id },
        })),
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "gdpr_request_created",
        entityType: "gdpr_request",
        entityId: gdprRequest.id,
        details: { requestType: data.requestType },
      },
    });

    return NextResponse.json({
      request: gdprRequest,
      message: data.requestType === "export"
        ? "Your data export is being prepared. You will receive a notification when ready."
        : "Your request has been submitted and will be reviewed within 30 days.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create GDPR request error:", error);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}

// Helper function to process export requests
async function processExportRequest(requestId: string, userId: string) {
  try {
    // Gather all user data
    const [
      userData,
      transactions,
      wallets,
      paymentMethods,
      devices,
      activityLogs,
      notifications,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          country: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          locale: true,
          timezone: true,
          preferredCurrency: true,
          createdAt: true,
        },
      }),
      prisma.transaction.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        select: {
          id: true,
          referenceId: true,
          type: true,
          status: true,
          amount: true,
          currency: true,
          fee: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.wallet.findMany({
        where: { userId },
        select: {
          currency: true,
          balance: true,
          availableBalance: true,
          createdAt: true,
        },
      }),
      prisma.paymentMethod.findMany({
        where: { userId },
        select: {
          type: true,
          bankName: true,
          accountLast4: true,
          cardBrand: true,
          cardLast4: true,
          createdAt: true,
        },
      }),
      prisma.device.findMany({
        where: { userId },
        select: {
          deviceName: true,
          deviceType: true,
          browser: true,
          os: true,
          isTrusted: true,
          lastUsedAt: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.findMany({
        where: { userId },
        select: {
          action: true,
          entityType: true,
          details: true,
          ipAddress: true,
          createdAt: true,
        },
        take: 1000,
      }),
      prisma.notification.findMany({
        where: { userId },
        select: {
          type: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
        take: 1000,
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: userData,
      transactions,
      wallets,
      paymentMethods,
      devices,
      activityLogs,
      notifications,
    };

    // In production, upload to secure storage and generate download URL
    // For now, store the data directly
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Link expires in 7 days

    await prisma.gDPRRequest.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        // In production, this would be a presigned S3 URL
        exportUrl: `/api/gdpr/download/${requestId}`,
        exportExpiresAt: expiresAt,
      },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId,
        type: "system",
        title: "Data Export Ready",
        message: "Your personal data export is ready for download. The link will expire in 7 days.",
        data: { requestId },
      },
    });

    // Store export data temporarily (in production, use secure storage)
    await prisma.gDPRRequest.update({
      where: { id: requestId },
      data: {
        requestDetails: exportData as object,
      },
    });
  } catch (error) {
    console.error("Process export request error:", error);
    await prisma.gDPRRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", rejectionReason: "Export failed. Please try again." },
    });
  }
}
