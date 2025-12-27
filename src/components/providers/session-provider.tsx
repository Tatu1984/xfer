"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Role, AccountStatus } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  status: AccountStatus;
}

interface SessionContextType {
  user: SessionUser | null;
}

const SessionContext = createContext<SessionContextType>({ user: null });

export function SessionProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: SessionUser | null;
}) {
  return (
    <SessionContext.Provider value={{ user }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  return {
    data: context.user ? { user: context.user } : null,
    status: context.user ? "authenticated" : "unauthenticated",
  };
}
