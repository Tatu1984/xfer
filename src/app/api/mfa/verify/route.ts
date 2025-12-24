import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyMfaToken } from "@/lib/mfa";
import { mfaRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const verifySchema = z.object({
  userId: z.string(),
  token: z.string().min(1, "Token is required"),
  isBackupCode: z.boolean().optional(),
});

// POST /api/mfa/verify - Verify MFA token during login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, token, isBackupCode } = verifySchema.parse(body);

    // Rate limit MFA attempts
    const rateResult = mfaRateLimit(userId);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Get user with MFA settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mfaEnabled: true,
        mfaSecret: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      const prefs = user.notificationPreferences as { mfaBackupCodes?: string[] } | null;
      const hashedCodes = prefs?.mfaBackupCodes || [];

      for (let i = 0; i < hashedCodes.length; i++) {
        const match = await bcrypt.compare(token.toUpperCase(), hashedCodes[i]);
        if (match) {
          isValid = true;
          // Remove used backup code
          hashedCodes.splice(i, 1);
          await prisma.user.update({
            where: { id: userId },
            data: {
              notificationPreferences: {
                ...prefs,
                mfaBackupCodes: hashedCodes,
              },
            },
          });
          break;
        }
      }
    } else {
      // Verify TOTP token
      isValid = verifyMfaToken(token, user.mfaSecret);
    }

    if (!isValid) {
      // Log failed attempt
      await prisma.activityLog.create({
        data: {
          userId,
          action: "mfa_failed",
          entityType: "user",
          entityId: userId,
          details: { type: isBackupCode ? "backup_code" : "totp" },
        },
      });

      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 401 }
      );
    }

    // Log successful verification
    await prisma.activityLog.create({
      data: {
        userId,
        action: "mfa_verified",
        entityType: "user",
        entityId: userId,
        details: { type: isBackupCode ? "backup_code" : "totp" },
      },
    });

    return NextResponse.json({
      success: true,
      verified: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("MFA verification error:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
