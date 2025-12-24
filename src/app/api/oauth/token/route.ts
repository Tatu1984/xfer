import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const tokenSchema = z.object({
  grantType: z.enum(["authorization_code", "refresh_token"]),
  clientId: z.string(),
  clientSecret: z.string().optional(),
  code: z.string().optional(),
  redirectUri: z.string().optional(),
  refreshToken: z.string().optional(),
  codeVerifier: z.string().optional(),
});

// Generate tokens
function generateTokens() {
  return {
    accessToken: crypto.randomBytes(32).toString("hex"),
    refreshToken: crypto.randomBytes(32).toString("hex"),
  };
}

// Verify PKCE code verifier
function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }

  if (method === "S256") {
    const hash = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    return hash === codeChallenge;
  }

  return false;
}

// POST - Token endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle form data format (OAuth spec)
    const params = tokenSchema.parse({
      grantType: body.grant_type,
      clientId: body.client_id,
      clientSecret: body.client_secret,
      code: body.code,
      redirectUri: body.redirect_uri,
      refreshToken: body.refresh_token,
      codeVerifier: body.code_verifier,
    });

    // Find client
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: params.clientId },
    });

    if (!client || !client.isActive) {
      return NextResponse.json({ error: "invalid_client" }, { status: 401 });
    }

    // Verify client secret for confidential clients
    if (client.isConfidential) {
      if (!params.clientSecret) {
        return NextResponse.json({ error: "invalid_client" }, { status: 401 });
      }

      const secretValid = await bcrypt.compare(params.clientSecret, client.clientSecret);
      if (!secretValid) {
        return NextResponse.json({ error: "invalid_client" }, { status: 401 });
      }
    }

    let userId: string;
    let scopes: string[];

    if (params.grantType === "authorization_code") {
      // Exchange authorization code for tokens
      if (!params.code) {
        return NextResponse.json({ error: "invalid_request", description: "code required" }, { status: 400 });
      }

      const authCode = await prisma.oAuthAuthorizationCode.findUnique({
        where: { code: params.code },
      });

      if (!authCode) {
        return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
      }

      if (authCode.expiresAt < new Date()) {
        await prisma.oAuthAuthorizationCode.delete({ where: { id: authCode.id } });
        return NextResponse.json({ error: "invalid_grant", description: "code expired" }, { status: 400 });
      }

      if (authCode.clientId !== client.id) {
        return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
      }

      if (authCode.redirectUri !== params.redirectUri) {
        return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
      }

      // Verify PKCE if code challenge was used
      if (authCode.codeChallenge) {
        if (!params.codeVerifier) {
          return NextResponse.json({ error: "invalid_request", description: "code_verifier required" }, { status: 400 });
        }

        const valid = verifyCodeChallenge(
          params.codeVerifier,
          authCode.codeChallenge,
          authCode.codeChallengeMethod || "plain"
        );

        if (!valid) {
          return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
        }
      }

      userId = authCode.userId;
      scopes = authCode.scopes;

      // Delete used authorization code
      await prisma.oAuthAuthorizationCode.delete({ where: { id: authCode.id } });

    } else if (params.grantType === "refresh_token") {
      // Refresh access token
      if (!params.refreshToken) {
        return NextResponse.json({ error: "invalid_request", description: "refresh_token required" }, { status: 400 });
      }

      const existingToken = await prisma.oAuthToken.findUnique({
        where: { refreshToken: params.refreshToken },
      });

      if (!existingToken) {
        return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
      }

      if (existingToken.revokedAt) {
        return NextResponse.json({ error: "invalid_grant", description: "token revoked" }, { status: 400 });
      }

      if (existingToken.refreshTokenExpiresAt && existingToken.refreshTokenExpiresAt < new Date()) {
        return NextResponse.json({ error: "invalid_grant", description: "refresh token expired" }, { status: 400 });
      }

      if (existingToken.clientId !== client.id) {
        return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
      }

      userId = existingToken.userId;
      scopes = existingToken.scopes;

      // Revoke old token
      await prisma.oAuthToken.update({
        where: { id: existingToken.id },
        data: { revokedAt: new Date() },
      });

    } else {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
    }

    // Generate new tokens
    const tokens = generateTokens();
    const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.oAuthToken.create({
      data: {
        clientId: client.id,
        userId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        scopes,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      },
    });

    return NextResponse.json({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: tokens.refreshToken,
      scope: scopes.join(" "),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", details: error.issues }, { status: 400 });
    }
    console.error("OAuth token error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
