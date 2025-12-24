import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create test users with different roles
  const password = await bcrypt.hash("Password123!", 12);

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@xfer.com" },
    update: {},
    create: {
      email: "superadmin@xfer.com",
      passwordHash: password,
      firstName: "Super",
      lastName: "Admin",
      displayName: "Super Admin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
      wallets: {
        create: {
          currency: "USD",
          balance: 100000,
          availableBalance: 100000,
          isDefault: true,
        },
      },
      kycVerification: {
        create: {
          status: "APPROVED",
          level: 3,
          verifiedAt: new Date(),
        },
      },
      riskProfile: {
        create: {
          riskLevel: "LOW",
          riskScore: 5,
        },
      },
    },
  });
  console.log("Created Super Admin:", superAdmin.email);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@xfer.com" },
    update: {},
    create: {
      email: "admin@xfer.com",
      passwordHash: password,
      firstName: "Admin",
      lastName: "User",
      displayName: "Admin User",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
      wallets: {
        create: {
          currency: "USD",
          balance: 50000,
          availableBalance: 50000,
          isDefault: true,
        },
      },
      kycVerification: {
        create: {
          status: "APPROVED",
          level: 3,
          verifiedAt: new Date(),
        },
      },
      riskProfile: {
        create: {
          riskLevel: "LOW",
          riskScore: 8,
        },
      },
    },
  });
  console.log("Created Admin:", admin.email);

  // Vendor
  const vendor = await prisma.user.upsert({
    where: { email: "vendor@xfer.com" },
    update: {},
    create: {
      email: "vendor@xfer.com",
      passwordHash: password,
      firstName: "Business",
      lastName: "Owner",
      displayName: "Acme Store",
      role: "VENDOR",
      status: "ACTIVE",
      emailVerified: new Date(),
      wallets: {
        create: {
          currency: "USD",
          balance: 25000,
          availableBalance: 22000,
          pendingBalance: 3000,
          isDefault: true,
        },
      },
      kycVerification: {
        create: {
          status: "APPROVED",
          level: 3,
          verifiedAt: new Date(),
        },
      },
      riskProfile: {
        create: {
          riskLevel: "LOW",
          riskScore: 12,
        },
      },
      business: {
        create: {
          legalName: "Acme Store LLC",
          tradingName: "Acme Store",
          kybStatus: "APPROVED",
          businessType: "llc",
          industry: "E-commerce",
          website: "https://acmestore.com",
          verifiedAt: new Date(),
        },
      },
    },
  });
  console.log("Created Vendor:", vendor.email);

  // Regular User
  const user = await prisma.user.upsert({
    where: { email: "user@xfer.com" },
    update: {},
    create: {
      email: "user@xfer.com",
      passwordHash: password,
      firstName: "John",
      lastName: "Doe",
      displayName: "John Doe",
      role: "USER",
      status: "ACTIVE",
      emailVerified: new Date(),
      wallets: {
        create: [
          {
            currency: "USD",
            balance: 5420.50,
            availableBalance: 5200,
            pendingBalance: 220.50,
            isDefault: true,
          },
          {
            currency: "EUR",
            balance: 1250,
            availableBalance: 1250,
            isDefault: false,
          },
        ],
      },
      kycVerification: {
        create: {
          status: "APPROVED",
          level: 2,
          verifiedAt: new Date(),
        },
      },
      riskProfile: {
        create: {
          riskLevel: "LOW",
          riskScore: 10,
        },
      },
    },
  });
  console.log("Created User:", user.email);

  // Create some currencies
  await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  });
  await prisma.currency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  });
  await prisma.currency.upsert({
    where: { code: "GBP" },
    update: {},
    create: { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
  });
  console.log("Created currencies");

  console.log("\n✅ Database seeded successfully!\n");
  console.log("=".repeat(50));
  console.log("TEST CREDENTIALS (password for all: Password123!)");
  console.log("=".repeat(50));
  console.log("\n📧 Super Admin: superadmin@xfer.com");
  console.log("📧 Admin:       admin@xfer.com");
  console.log("📧 Vendor:      vendor@xfer.com");
  console.log("📧 User:        user@xfer.com");
  console.log("\n🔑 Password:    Password123!");
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
