import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { Role, AccountStatus } from "@prisma/client";

export interface Session {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role: Role;
    status: AccountStatus;
  };
}

interface TokenPayload {
  id: string;
  email: string;
  name?: string;
  role: Role;
  status: AccountStatus;
}

export async function auth(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
      return null;
    }

    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const user = payload as unknown as TokenPayload;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        image: null,
        role: user.role,
        status: user.status,
      },
    };
  } catch {
    return null;
  }
}
