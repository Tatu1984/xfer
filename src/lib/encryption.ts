import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Get encryption key from environment or generate
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  // If key is base64 encoded (32 bytes = 44 chars in base64)
  if (key.length === 44) {
    return Buffer.from(key, "base64");
  }
  // If key is hex encoded (32 bytes = 64 chars in hex)
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  // Derive key from password
  const salt = crypto.createHash("sha256").update("xfer-platform-salt").digest();
  return crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, "sha512");
}

// Encrypt sensitive data
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Combine iv + authTag + encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, "base64"),
  ]);

  return combined.toString("base64");
}

// Decrypt sensitive data
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

// Encrypt object fields
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const encrypted = { ...obj };
  for (const field of fields) {
    if (encrypted[field] && typeof encrypted[field] === "string") {
      encrypted[field] = encrypt(encrypted[field] as string) as T[keyof T];
    }
  }
  return encrypted;
}

// Decrypt object fields
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const decrypted = { ...obj };
  for (const field of fields) {
    if (decrypted[field] && typeof decrypted[field] === "string") {
      try {
        decrypted[field] = decrypt(decrypted[field] as string) as T[keyof T];
      } catch {
        // Field may not be encrypted, leave as is
      }
    }
  }
  return decrypted;
}

// Hash sensitive data (one-way, for lookups)
export function hashSensitive(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

// Generate secure random token
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("base64url");
}

// Encrypt bank account number (with format preservation)
export function encryptBankAccount(accountNumber: string): string {
  const encrypted = encrypt(accountNumber);
  const lastFour = accountNumber.slice(-4);
  return `enc:${encrypted}:${lastFour}`;
}

// Decrypt bank account number
export function decryptBankAccount(encryptedAccount: string): string {
  if (!encryptedAccount.startsWith("enc:")) {
    return encryptedAccount; // Not encrypted
  }
  const parts = encryptedAccount.split(":");
  return decrypt(parts[1]);
}

// Get masked bank account (for display)
export function getMaskedBankAccount(encryptedAccount: string): string {
  if (!encryptedAccount.startsWith("enc:")) {
    return `****${encryptedAccount.slice(-4)}`;
  }
  const parts = encryptedAccount.split(":");
  return `****${parts[2]}`;
}

// Encrypt SSN/Tax ID
export function encryptSSN(ssn: string): string {
  const cleaned = ssn.replace(/\D/g, "");
  const encrypted = encrypt(cleaned);
  const lastFour = cleaned.slice(-4);
  return `ssn:${encrypted}:${lastFour}`;
}

// Decrypt SSN
export function decryptSSN(encryptedSSN: string): string {
  if (!encryptedSSN.startsWith("ssn:")) {
    return encryptedSSN;
  }
  const parts = encryptedSSN.split(":");
  const decrypted = decrypt(parts[1]);
  // Format as XXX-XX-XXXX
  return `${decrypted.slice(0, 3)}-${decrypted.slice(3, 5)}-${decrypted.slice(5)}`;
}

// Get masked SSN
export function getMaskedSSN(encryptedSSN: string): string {
  if (!encryptedSSN.startsWith("ssn:")) {
    return `***-**-${encryptedSSN.slice(-4)}`;
  }
  const parts = encryptedSSN.split(":");
  return `***-**-${parts[2]}`;
}

// Key rotation support
export interface EncryptedData {
  version: number;
  data: string;
}

export function encryptWithVersion(plaintext: string, version: number = 1): EncryptedData {
  return {
    version,
    data: encrypt(plaintext),
  };
}

export function decryptWithVersion(encrypted: EncryptedData): string {
  // In production, handle different versions/keys here
  return decrypt(encrypted.data);
}

// Secure comparison (timing-safe)
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Generate key pair for asymmetric encryption
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

// Encrypt with public key
export function encryptWithPublicKey(plaintext: string, publicKey: string): string {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(plaintext)
  );
  return encrypted.toString("base64");
}

// Decrypt with private key
export function decryptWithPrivateKey(encrypted: string, privateKey: string): string {
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted, "base64")
  );
  return decrypted.toString("utf8");
}
