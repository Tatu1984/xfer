import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-utils";

const authorizeSchema = z.object({
  clientId: z.string(),
  redirectUri: z.string().url(),
  responseType: z.enum(["code"]),
  scope: z.string(),
  state: z.string(),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.enum(["plain", "S256"]).optional(),
});

// GET - Authorization endpoint (render consent page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = authorizeSchema.parse({
      clientId: searchParams.get("client_id"),
      redirectUri: searchParams.get("redirect_uri"),
      responseType: searchParams.get("response_type"),
      scope: searchParams.get("scope"),
      state: searchParams.get("state"),
      codeChallenge: searchParams.get("code_challenge"),
      codeChallengeMethod: searchParams.get("code_challenge_method"),
    });

    // Find OAuth client
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: params.clientId },
    });

    if (!client || !client.isActive) {
      return NextResponse.json({ error: "invalid_client" }, { status: 400 });
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(params.redirectUri)) {
      return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
    }

    // Validate scopes
    const requestedScopes = params.scope.split(" ");
    const invalidScopes = requestedScopes.filter((s) => !client.scopes.includes(s));
    if (invalidScopes.length > 0) {
      return NextResponse.json({ error: "invalid_scope", invalid: invalidScopes }, { status: 400 });
    }

    // Return client info for consent page
    return NextResponse.json({
      client: {
        name: client.name,
        description: client.description,
        logoUrl: client.logoUrl,
        websiteUrl: client.websiteUrl,
      },
      scopes: requestedScopes,
      state: params.state,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", details: error.issues }, { status: 400 });
    }
    console.error("OAuth authorize GET error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST - User grants authorization
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const params = authorizeSchema.parse(body);

    // Find OAuth client
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: params.clientId },
    });

    if (!client || !client.isActive) {
      return NextResponse.json({ error: "invalid_client" }, { status: 400 });
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(params.redirectUri)) {
      return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.oAuthAuthorizationCode.create({
      data: {
        clientId: client.id,
        userId: user.id,
        code,
        scopes: params.scope.split(" "),
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        codeChallengeMethod: params.codeChallengeMethod,
        expiresAt,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "oauth_authorized",
        details: {
          clientId: params.clientId,
          clientName: client.name,
          scopes: params.scope.split(" "),
        },
      },
    });

    // Return redirect URL with code
    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set("code", code);
    redirectUrl.searchParams.set("state", params.state);

    return NextResponse.json({
      redirectUrl: redirectUrl.toString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", details: error.issues }, { status: 400 });
    }
    console.error("OAuth authorize POST error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
