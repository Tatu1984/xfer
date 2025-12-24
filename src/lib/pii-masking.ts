// PII (Personally Identifiable Information) Masking Utilities

export interface MaskingOptions {
  showFirst?: number;
  showLast?: number;
  maskChar?: string;
  preserveFormat?: boolean;
}

const DEFAULT_OPTIONS: MaskingOptions = {
  showFirst: 0,
  showLast: 4,
  maskChar: "*",
  preserveFormat: false,
};

// Mask email address
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;

  const [localPart, domain] = email.split("@");
  const [domainName, tld] = domain.split(".");

  // Show first and last character of local part
  let maskedLocal: string;
  if (localPart.length <= 2) {
    maskedLocal = "*".repeat(localPart.length);
  } else {
    maskedLocal = localPart[0] + "*".repeat(localPart.length - 2) + localPart[localPart.length - 1];
  }

  // Show first character of domain
  const maskedDomain = domainName[0] + "*".repeat(domainName.length - 1);

  return `${maskedLocal}@${maskedDomain}.${tld}`;
}

// Mask phone number
export function maskPhone(phone: string, options: MaskingOptions = {}): string {
  if (!phone) return phone;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 7) return "*".repeat(digits.length);

  const masked = "*".repeat(digits.length - (opts.showFirst || 0) - (opts.showLast || 0));
  const first = digits.slice(0, opts.showFirst || 0);
  const last = digits.slice(-(opts.showLast || 4));

  if (opts.preserveFormat) {
    // Try to preserve original format
    let result = phone;
    let digitIndex = 0;

    for (let i = 0; i < result.length; i++) {
      if (/\d/.test(result[i])) {
        if (digitIndex < (opts.showFirst || 0) || digitIndex >= digits.length - (opts.showLast || 4)) {
          // Keep original digit
        } else {
          result = result.slice(0, i) + opts.maskChar + result.slice(i + 1);
        }
        digitIndex++;
      }
    }
    return result;
  }

  return `${first}${masked}${last}`;
}

// Mask SSN (Social Security Number)
export function maskSSN(ssn: string): string {
  if (!ssn) return ssn;

  const digits = ssn.replace(/\D/g, "");
  if (digits.length !== 9) return "***-**-****";

  return `***-**-${digits.slice(-4)}`;
}

// Mask credit card number
export function maskCreditCard(cardNumber: string, options: MaskingOptions = {}): string {
  if (!cardNumber) return cardNumber;

  const opts = { showFirst: 0, showLast: 4, ...options };
  const digits = cardNumber.replace(/\D/g, "");

  if (digits.length < 12) return "*".repeat(digits.length);

  const first = digits.slice(0, opts.showFirst || 0);
  const last = digits.slice(-(opts.showLast || 4));
  const masked = "*".repeat(digits.length - (opts.showFirst || 0) - (opts.showLast || 4));

  // Format as groups of 4
  const fullMasked = first + masked + last;
  return fullMasked.match(/.{1,4}/g)?.join(" ") || fullMasked;
}

// Mask bank account number
export function maskBankAccount(accountNumber: string, options: MaskingOptions = {}): string {
  if (!accountNumber) return accountNumber;

  const opts = { showLast: 4, ...options };
  const cleaned = accountNumber.replace(/\D/g, "");

  if (cleaned.length <= (opts.showLast || 4)) {
    return "*".repeat(cleaned.length);
  }

  const masked = "*".repeat(cleaned.length - (opts.showLast || 4));
  const last = cleaned.slice(-(opts.showLast || 4));

  return masked + last;
}

// Mask routing number
export function maskRoutingNumber(routingNumber: string): string {
  if (!routingNumber) return routingNumber;

  const digits = routingNumber.replace(/\D/g, "");
  if (digits.length < 9) return "*".repeat(digits.length);

  return `****${digits.slice(-4)}`;
}

// Mask name (show first name initial and last name initial)
export function maskName(fullName: string): string {
  if (!fullName) return fullName;

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return fullName;

  if (parts.length === 1) {
    return parts[0][0] + "*".repeat(parts[0].length - 1);
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  const maskedFirst = firstName[0] + "*".repeat(firstName.length - 1);
  const maskedLast = lastName[0] + "*".repeat(lastName.length - 1);

  return `${maskedFirst} ${maskedLast}`;
}

// Mask address
export function maskAddress(address: string): string {
  if (!address) return address;

  // Show just the first few characters and any numbers
  const parts = address.split(" ");
  if (parts.length <= 2) return "*".repeat(address.length);

  // Keep numbers (like street number) but mask street name
  const result = parts.map((part, index) => {
    if (/^\d+$/.test(part)) return part; // Keep pure numbers
    if (index === parts.length - 1) return part; // Keep last part (likely city/state/zip)
    return part[0] + "*".repeat(part.length - 1);
  });

  return result.join(" ");
}

// Mask date of birth
export function maskDOB(dob: string | Date): string {
  if (!dob) return "**/**/****";

  const date = dob instanceof Date ? dob : new Date(dob);
  if (isNaN(date.getTime())) return "**/**/****";

  const year = date.getFullYear();
  return `**/**/${year}`;
}

// Mask IP address
export function maskIP(ip: string): string {
  if (!ip) return ip;

  // IPv4
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
  }

  // IPv6
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:****:****:****:****:****:****`;
    }
  }

  return ip;
}

// Mask driver's license
export function maskDriversLicense(license: string): string {
  if (!license) return license;

  const cleaned = license.replace(/\W/g, "");
  if (cleaned.length < 4) return "*".repeat(cleaned.length);

  return "*".repeat(cleaned.length - 4) + cleaned.slice(-4);
}

// Mask passport number
export function maskPassport(passport: string): string {
  if (!passport) return passport;

  const cleaned = passport.replace(/\s/g, "");
  if (cleaned.length < 4) return "*".repeat(cleaned.length);

  return cleaned[0] + "*".repeat(cleaned.length - 4) + cleaned.slice(-3);
}

// Generic object masking
export interface FieldMaskConfig {
  field: string;
  type: "email" | "phone" | "ssn" | "creditCard" | "bankAccount" | "name" | "address" | "dob" | "ip" | "custom";
  customMasker?: (value: string) => string;
}

export function maskObject<T extends Record<string, unknown>>(
  obj: T,
  fields: FieldMaskConfig[]
): T {
  const masked = { ...obj };

  for (const config of fields) {
    const value = masked[config.field];
    if (value === undefined || value === null) continue;

    const strValue = String(value);

    switch (config.type) {
      case "email":
        (masked as Record<string, unknown>)[config.field] = maskEmail(strValue);
        break;
      case "phone":
        (masked as Record<string, unknown>)[config.field] = maskPhone(strValue);
        break;
      case "ssn":
        (masked as Record<string, unknown>)[config.field] = maskSSN(strValue);
        break;
      case "creditCard":
        (masked as Record<string, unknown>)[config.field] = maskCreditCard(strValue);
        break;
      case "bankAccount":
        (masked as Record<string, unknown>)[config.field] = maskBankAccount(strValue);
        break;
      case "name":
        (masked as Record<string, unknown>)[config.field] = maskName(strValue);
        break;
      case "address":
        (masked as Record<string, unknown>)[config.field] = maskAddress(strValue);
        break;
      case "dob":
        (masked as Record<string, unknown>)[config.field] = maskDOB(strValue);
        break;
      case "ip":
        (masked as Record<string, unknown>)[config.field] = maskIP(strValue);
        break;
      case "custom":
        if (config.customMasker) {
          (masked as Record<string, unknown>)[config.field] = config.customMasker(strValue);
        }
        break;
    }
  }

  return masked;
}

// User-safe object transformer (removes sensitive fields, masks others)
export function sanitizeUserData(user: Record<string, unknown>): Record<string, unknown> {
  // Fields to completely remove
  const removeFields = [
    "password",
    "passwordHash",
    "pin",
    "pinHash",
    "securityAnswers",
    "totpSecret",
    "backupCodes",
    "ssn",
    "taxId",
    "bankAccountNumber",
    "routingNumber",
  ];

  // Create copy without sensitive fields
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(user)) {
    if (!removeFields.includes(key)) {
      sanitized[key] = value;
    }
  }

  // Mask remaining PII
  if (sanitized.email) sanitized.email = maskEmail(String(sanitized.email));
  if (sanitized.phone) sanitized.phone = maskPhone(String(sanitized.phone));
  if (sanitized.dateOfBirth) sanitized.dateOfBirth = maskDOB(String(sanitized.dateOfBirth));

  return sanitized;
}

// Audit log masking (for logging sensitive operations)
export function maskForAuditLog(data: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...data };

  // Auto-detect and mask common PII patterns
  for (const [key, value] of Object.entries(masked)) {
    if (value === null || value === undefined) continue;

    const strValue = String(value);
    const lowerKey = key.toLowerCase();

    // Email detection
    if (lowerKey.includes("email") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
      masked[key] = maskEmail(strValue);
    }
    // Phone detection
    else if (lowerKey.includes("phone") || lowerKey.includes("mobile") || lowerKey.includes("tel")) {
      masked[key] = maskPhone(strValue);
    }
    // SSN detection
    else if (lowerKey.includes("ssn") || lowerKey.includes("social") || /^\d{3}-?\d{2}-?\d{4}$/.test(strValue)) {
      masked[key] = maskSSN(strValue);
    }
    // Credit card detection
    else if (lowerKey.includes("card") || lowerKey.includes("cc") || /^\d{13,19}$/.test(strValue.replace(/\D/g, ""))) {
      masked[key] = maskCreditCard(strValue);
    }
    // Account number detection
    else if (lowerKey.includes("account") && /^\d{4,17}$/.test(strValue.replace(/\D/g, ""))) {
      masked[key] = maskBankAccount(strValue);
    }
    // Password/secret detection
    else if (lowerKey.includes("password") || lowerKey.includes("secret") || lowerKey.includes("token") || lowerKey.includes("key")) {
      masked[key] = "[REDACTED]";
    }
  }

  return masked;
}
