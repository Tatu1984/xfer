import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, you will receive reset instructions.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Delete any existing reset tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: user.email,
        type: "PASSWORD_RESET",
      },
    });

    // Create new reset token (expires in 1 hour)
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token: hashedToken,
        type: "PASSWORD_RESET",
        expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "USER",
        entityId: user.id,
        details: {
          email: user.email,
          requestedAt: new Date().toISOString(),
        },
      },
    });

    // In production, send email here
    // For now, log the reset link (in dev mode)
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
    console.log("Password reset URL:", resetUrl);

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive reset instructions.",
      // Only include in development for testing
      ...(process.env.NODE_ENV === "development" && { resetUrl }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid email address", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
