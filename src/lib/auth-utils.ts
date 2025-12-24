import { auth } from "./auth";
import type { Role } from "@prisma/client";

type AuthResult = {
  id: string;
  email: string;
  role: Role;
} | {
  error: string;
  status: number;
};

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function requireRole(roles: Role[]): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  if (!roles.includes(session.user.role)) {
    return { error: "Forbidden", status: 403 };
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function getSession() {
  return auth();
}
