import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireRole,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/admin/users - List all users (admin only)
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const search = searchParams.get("search");
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const kycStatus = searchParams.get("kycStatus");

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (role) {
    where.role = role;
  }
  if (status) {
    where.status = status;
  }
  if (kycStatus) {
    where.kycVerification = { status: kycStatus };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        kycVerification: {
          select: { status: true, level: true },
        },
        wallets: {
          select: { currency: true, balance: true },
          where: { isDefault: true },
        },
        riskProfile: {
          select: { riskLevel: true, riskScore: true },
        },
        _count: {
          select: { sentTransactions: true, disputes: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return successResponse({
    users: users.map((user) => ({
      ...user,
      walletBalance: user.wallets[0] ? Number(user.wallets[0].balance) : 0,
      walletCurrency: user.wallets[0]?.currency || "USD",
      transactionCount: user._count.sentTransactions,
      disputeCount: user._count.disputes,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// PATCH /api/admin/users - Update user status (admin only)
const updateUserSchema = z.object({
  userId: z.string(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
  role: z.enum(["USER", "VENDOR", "ADMIN"]).optional(),
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const { user: adminUser } = authResult;

  try {
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    // Prevent admins from modifying super admins
    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!targetUser) {
      return errorResponse("User not found", 404);
    }

    if (targetUser.role === "SUPER_ADMIN" && adminUser.role !== "SUPER_ADMIN") {
      return errorResponse("Cannot modify super admin", 403);
    }

    // Prevent changing own role
    if (data.role && data.userId === adminUser.id) {
      return errorResponse("Cannot change your own role", 400);
    }

    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.role) updateData.role = data.role;

    const updated = await prisma.user.update({
      where: { id: data.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminUser.id,
        action: "user_updated",
        entityType: "user",
        entityId: data.userId,
        details: updateData as object,
      },
    });

    return successResponse(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    return errorResponse("Failed to update user", 500);
  }
}
