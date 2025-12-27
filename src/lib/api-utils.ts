import { auth, type Session } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

type AuthError = { error: string; status: number };
type AuthSuccess = { session: Session; user: Session["user"] };
type AuthResult = AuthError | AuthSuccess;

export async function getSession() {
  const session = await auth();
  return session;
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await getSession();
  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }
  return { session, user: session.user };
}

export async function requireRole(allowedRoles: Role[]): Promise<AuthResult> {
  const result = await requireAuth();
  if ("error" in result) {
    return result;
  }

  if (!allowedRoles.includes(result.user.role as Role)) {
    return { error: "Forbidden", status: 403 };
  }

  return result;
}

export function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function successResponse<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

// Generate unique reference IDs
export function generateReferenceId(prefix: string = "TXN"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Calculate fee based on transaction type and amount
export function calculateFee(amount: number, type: string): number {
  // Simple fee structure - can be made configurable later
  const feeRates: Record<string, { percentage: number; fixed: number; min: number; max: number }> = {
    TRANSFER_OUT: { percentage: 0, fixed: 0, min: 0, max: 0 }, // Free P2P
    PAYMENT: { percentage: 2.9, fixed: 0.30, min: 0.30, max: 100 }, // Merchant payments
    PAYOUT: { percentage: 1.0, fixed: 0.25, min: 0.25, max: 25 }, // Payouts
    WITHDRAWAL: { percentage: 0, fixed: 0, min: 0, max: 0 }, // Free withdrawals
    DEFAULT: { percentage: 0, fixed: 0, min: 0, max: 0 },
  };

  const rate = feeRates[type] || feeRates.DEFAULT;
  let fee = (amount * rate.percentage / 100) + rate.fixed;

  fee = Math.max(fee, rate.min);
  fee = Math.min(fee, rate.max);

  return Math.round(fee * 100) / 100; // Round to 2 decimal places
}

// Validate amount
export function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }
  if (amount > 100000) {
    return { valid: false, error: "Amount exceeds maximum limit of $100,000" };
  }
  return { valid: true };
}

export { prisma };
