import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-utils";

const sendCodeSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number format"),
});

const verifyCodeSchema = z.object({
  phone: z.string(),
  code: z.string().length(6),
});

// Generate 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST - Send verification code
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { phone } = sendCodeSchema.parse(body);

    // Check if phone already verified by another user
    const existingPhone = await prisma.user.findFirst({
      where: { phone, id: { not: user.id }, phoneVerified: { not: null } },
    });

    if (existingPhone) {
      return NextResponse.json(
        { error: "Phone number already in use" },
        { status: 400 }
      );
    }

    // Check rate limit (max 5 requests per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await prisma.phoneVerification.count({
      where: {
        userId: user.id,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentAttempts >= 5) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Expire any existing verifications for this user
    await prisma.phoneVerification.updateMany({
      where: {
        userId: user.id,
        status: "PENDING",
      },
      data: { status: "EXPIRED" },
    });

    // Generate new code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.phoneVerification.create({
      data: {
        userId: user.id,
        phone,
        code,
        expiresAt,
      },
    });

    // In production, send SMS via Twilio/AWS SNS
    // For now, we'll log it (in dev) or skip
    console.log(`[DEV] Phone verification code for ${phone}: ${code}`);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "phone_verification_requested",
        details: { phone: `${phone.slice(0, 4)}****${phone.slice(-2)}` },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Verification code sent",
      expiresIn: 600, // 10 minutes
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Send phone code error:", error);
    return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
  }
}

// PUT - Verify code
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { phone, code } = verifyCodeSchema.parse(body);

    // Find pending verification
    const verification = await prisma.phoneVerification.findFirst({
      where: {
        userId: user.id,
        phone,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verification) {
      return NextResponse.json(
        { error: "No pending verification found or code expired" },
        { status: 400 }
      );
    }

    // Check attempts
    if (verification.attempts >= verification.maxAttempts) {
      await prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code." },
        { status: 400 }
      );
    }

    // Verify code
    if (verification.code !== code) {
      await prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json(
        { error: "Invalid code", attemptsRemaining: verification.maxAttempts - verification.attempts - 1 },
        { status: 400 }
      );
    }

    // Success - update verification and user
    await prisma.$transaction([
      prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { status: "VERIFIED", verifiedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { phone, phoneVerified: new Date() },
      }),
    ]);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "phone_verified",
        details: { phone: `${phone.slice(0, 4)}****${phone.slice(-2)}` },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Phone number verified",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Verify phone code error:", error);
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
  }
}
