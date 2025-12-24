import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-utils";
import { unlockAccount } from "@/lib/account-lockout";
import { prisma } from "@/lib/prisma";

// POST /api/admin/users/[id]/unlock - Unlock a user account
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId } = await params;
  const adminUser = authResult.user as { id: string; email: string };

  try {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, lockedUntil: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if actually locked
    if (!user.lockedUntil || user.lockedUntil <= new Date()) {
      return NextResponse.json(
        { error: "User account is not locked" },
        { status: 400 }
      );
    }

    // Unlock account
    await unlockAccount(userId);

    // Log admin action
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: "admin_unlock_account",
        entityType: "user",
        entityId: userId,
        details: {
          targetEmail: user.email,
          unlockedBy: adminUser.email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Account unlocked successfully",
    });
  } catch (error) {
    console.error("Unlock account error:", error);
    return NextResponse.json(
      { error: "Failed to unlock account" },
      { status: 500 }
    );
  }
}
