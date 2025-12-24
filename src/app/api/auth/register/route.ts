import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  accountType: z.enum(["USER", "VENDOR"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Check if phone is already in use
    if (validatedData.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: validatedData.phone },
      });

      if (existingPhone) {
        return NextResponse.json(
          { error: "This phone number is already in use" },
          { status: 400 }
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, 12);

    // Create user with related records
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: validatedData.email,
          passwordHash,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          displayName: `${validatedData.firstName} ${validatedData.lastName}`,
          phone: validatedData.phone || null,
          role: validatedData.accountType,
          status: "PENDING",
        },
      });

      // Create default USD wallet
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          currency: "USD",
          isDefault: true,
        },
      });

      // Create KYC verification record
      await tx.kYCVerification.create({
        data: {
          userId: newUser.id,
          status: "NOT_STARTED",
        },
      });

      // Create risk profile
      await tx.riskProfile.create({
        data: {
          userId: newUser.id,
          riskLevel: "LOW",
        },
      });

      // If vendor, create business record
      if (validatedData.accountType === "VENDOR") {
        await tx.business.create({
          data: {
            userId: newUser.id,
            kybStatus: "NOT_STARTED",
          },
        });
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: newUser.id,
          action: "account_created",
          entityType: "user",
          entityId: newUser.id,
          details: {
            accountType: validatedData.accountType,
            method: "credentials",
          },
        },
      });

      return newUser;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
