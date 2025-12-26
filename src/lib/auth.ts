import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role, AccountStatus } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: Role;
      status: AccountStatus;
    };
  }

  interface User {
    role: Role;
    status: AccountStatus;
    firstName?: string | null;
    lastName?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: AccountStatus;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma) as never,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          // Update failed login attempts
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: { increment: 1 },
              lockedUntil:
                user.failedLoginAttempts >= 4
                  ? new Date(Date.now() + 30 * 60 * 1000) // Lock for 30 minutes
                  : null,
            },
          });
          throw new Error("Invalid credentials");
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("Account is locked. Please try again later.");
        }

        // Check account status
        if (user.status === "SUSPENDED") {
          throw new Error("Account is suspended. Please contact support.");
        }

        if (user.status === "CLOSED") {
          throw new Error("Account has been closed.");
        }

        // Reset failed login attempts and update last login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || `${user.firstName} ${user.lastName}`.trim() || null,
          image: user.avatarUrl,
          role: user.role,
          status: user.status,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.status = token.status as AccountStatus;
      }
      return session;
    },
    async signIn({ user }) {
      // Additional sign-in checks can be added here
      if (user.status === "SUSPENDED" || user.status === "CLOSED") {
        return false;
      }
      return true;
    },
  },
  events: {
    async signIn({ user }) {
      // Log activity
      if (user?.id) {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: "login",
            entityType: "user",
            entityId: user.id,
            details: { method: "credentials" },
          },
        });
      }
    },
  },
});
