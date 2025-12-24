import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { generateMfaSecret, generateQrCodeDataUrl, generateBackupCodes } from "@/lib/mfa";
import bcrypt from "bcryptjs";

// GET /api/mfa/setup - Generate MFA secret and QR code
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    // Check if MFA is already enabled
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEnabled: true, email: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (dbUser.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });
    }

    // Generate new secret
    const secret = generateMfaSecret();
    const qrCodeDataUrl = await generateQrCodeDataUrl(dbUser.email, secret);

    // Store the secret temporarily (not enabled yet)
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: secret },
    });

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
      message: "Scan the QR code with your authenticator app, then verify with a code",
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    return NextResponse.json({ error: "Failed to setup MFA" }, { status: 500 });
  }
}

// POST /api/mfa/setup - Verify and enable MFA
const verifySchema = z.object({
  token: z.string().length(6, "Token must be 6 digits"),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { token } = verifySchema.parse(body);

    // Get user with MFA secret
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaSecret: true, mfaEnabled: true, email: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (dbUser.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });
    }

    if (!dbUser.mfaSecret) {
      return NextResponse.json({ error: "Please start MFA setup first" }, { status: 400 });
    }

    // Verify the token
    const { verifyMfaToken } = await import("@/lib/mfa");
    const isValid = verifyMfaToken(token, dbUser.mfaSecret);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedCodes = await Promise.all(
      backupCodes.map(code => bcrypt.hash(code, 10))
    );

    // Enable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        // Store hashed backup codes in notificationPreferences temporarily
        // In production, create a separate BackupCode table
        notificationPreferences: {
          ...(typeof (await prisma.user.findUnique({ where: { id: user.id } }))?.notificationPreferences === 'object'
            ? (await prisma.user.findUnique({ where: { id: user.id } }))?.notificationPreferences as object
            : {}),
          mfaBackupCodes: hashedCodes,
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "mfa_enabled",
        entityType: "user",
        entityId: user.id,
        details: { method: "totp" },
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "security",
        title: "Two-Factor Authentication Enabled",
        message: "You have successfully enabled two-factor authentication on your account.",
      },
    });

    return NextResponse.json({
      success: true,
      backupCodes,
      message: "MFA enabled successfully. Save your backup codes securely.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("MFA verify error:", error);
    return NextResponse.json({ error: "Failed to verify MFA" }, { status: 500 });
  }
}

// DELETE /api/mfa/setup - Disable MFA
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { password, token } = body;

    // Get user
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEnabled: true, mfaSecret: true, passwordHash: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!dbUser.mfaEnabled) {
      return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
    }

    // Verify password
    if (!dbUser.passwordHash) {
      return NextResponse.json({ error: "Password not set" }, { status: 400 });
    }

    const isPasswordValid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Verify MFA token
    const { verifyMfaToken } = await import("@/lib/mfa");
    const isTokenValid = verifyMfaToken(token, dbUser.mfaSecret!);
    if (!isTokenValid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "mfa_disabled",
        entityType: "user",
        entityId: user.id,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "security",
        title: "Two-Factor Authentication Disabled",
        message: "Two-factor authentication has been disabled on your account.",
      },
    });

    return NextResponse.json({
      success: true,
      message: "MFA disabled successfully",
    });
  } catch (error) {
    console.error("MFA disable error:", error);
    return NextResponse.json({ error: "Failed to disable MFA" }, { status: 500 });
  }
}
