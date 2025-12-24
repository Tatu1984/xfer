import { authenticator } from "otplib";
import * as QRCode from "qrcode";

// Configure TOTP settings
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1,
};

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function generateMfaToken(secret: string): string {
  return authenticator.generate(secret);
}

export function verifyMfaToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

export async function generateQrCodeDataUrl(
  email: string,
  secret: string,
  issuer: string = "Xfer"
): Promise<string> {
  const otpAuthUrl = authenticator.keyuri(email, issuer, secret);
  return QRCode.toDataURL(otpAuthUrl);
}

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}
