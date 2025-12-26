import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const createAccountSchema = z.object({
  accountName: z.string().min(1),
  bankName: z.string().min(1),
  bankCountry: z.string().length(2),
  currency: z.string().length(3),
  accountNumber: z.string().min(4),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
  accountType: z.enum(["operating", "reserve", "settlement"]),
  isPrimary: z.boolean().default(false),
  dailyLimit: z.number().positive().default(1000000),
});

// GET - List company bank accounts
export async function GET() {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const accounts = await prisma.companyBankAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            deposits: true,
            withdrawals: true,
            settlements: true,
          },
        },
      },
    });

    // Get total balances by currency
    const balanceByCurrency = await prisma.companyBankAccount.groupBy({
      by: ["currency"],
      _sum: { balance: true },
      where: { isActive: true },
    });

    return NextResponse.json({
      accounts: accounts.map((a: typeof accounts[number]) => ({
        ...a,
        accountNumber: `****${a.accountNumber.slice(-4)}`,
      })),
      summary: {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter((a: typeof accounts[number]) => a.isActive).length,
        balanceByCurrency: Object.fromEntries(
          balanceByCurrency.map((b: typeof balanceByCurrency[number]) => [b.currency, Number(b._sum.balance)])
        ),
      },
    });
  } catch (error) {
    console.error("Get company accounts error:", error);
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

// POST - Create company bank account
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const data = createAccountSchema.parse(body);

    // If setting as primary, unset other primary accounts for this currency
    if (data.isPrimary) {
      await prisma.companyBankAccount.updateMany({
        where: { currency: data.currency, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const account = await prisma.companyBankAccount.create({
      data: {
        ...data,
        balance: 0,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: authResult.id,
        action: "company_account_created",
        entityType: "company_bank_account",
        entityId: account.id,
        details: {
          accountName: data.accountName,
          currency: data.currency,
          accountType: data.accountType,
        },
      },
    });

    return NextResponse.json({
      account: {
        ...account,
        accountNumber: `****${account.accountNumber.slice(-4)}`,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create company account error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}

// PATCH - Update company bank account
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Account ID required" }, { status: 400 });
    }

    const account = await prisma.companyBankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // If setting as primary, unset other primary accounts
    if (updates.isPrimary) {
      await prisma.companyBankAccount.updateMany({
        where: { currency: account.currency, isPrimary: true, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.companyBankAccount.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      account: {
        ...updated,
        accountNumber: `****${updated.accountNumber.slice(-4)}`,
      },
    });
  } catch (error) {
    console.error("Update company account error:", error);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}
