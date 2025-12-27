import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Define route patterns for each role
const roleRoutes: Record<string, string[]> = {
  SUPER_ADMIN: ["/super-admin", "/admin", "/api/super-admin", "/api/admin"],
  ADMIN: ["/admin", "/api/admin"],
  VENDOR: ["/vendor", "/api/vendor"],
  USER: ["/dashboard", "/api/user"],
};

// Public routes that don't require authentication
const publicRoutes = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/error",
  "/api/auth",
];

// Routes that require authentication but allow any role
const authenticatedRoutes = [
  "/settings",
  "/profile",
  "/notifications",
  "/support",
];

function getRedirectForRole(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin";
    case "ADMIN":
      return "/admin";
    case "VENDOR":
      return "/vendor";
    case "USER":
    default:
      return "/dashboard";
  }
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  status: string;
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Check if it's a static file or Next.js internal route
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if it's an API route
  const isApiRoute = pathname.startsWith("/api");

  // Get the auth token from cookie
  const authToken = req.cookies.get("auth-token")?.value;
  const token = authToken ? await verifyToken(authToken) : null;

  // Allow public routes
  if (isPublicRoute) {
    // Redirect authenticated users away from auth pages
    if (token && pathname.startsWith("/auth/") && pathname !== "/auth/logout") {
      const redirectUrl = getRedirectForRole(token.role);
      return NextResponse.redirect(new URL(redirectUrl, nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Check authentication
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/auth/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = token.role;
  const userStatus = token.status;

  // Check if account is active
  if (userStatus !== "ACTIVE" && userStatus !== "PENDING") {
    if (isApiRoute) {
      return NextResponse.json({ error: "Account is not active" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/auth/account-suspended", nextUrl.origin));
  }

  // Check authenticated routes (any authenticated user can access)
  const isAuthenticatedRoute = authenticatedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAuthenticatedRoute) {
    return NextResponse.next();
  }

  // Check role-based access
  const allowedRoutes = roleRoutes[userRole] || [];
  const hasAccess = allowedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!hasAccess) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Redirect to appropriate dashboard based on role
    const redirectUrl = getRedirectForRole(userRole);
    return NextResponse.redirect(new URL(redirectUrl, nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
