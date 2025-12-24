import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Bank connectivity simulation - simulates ACH, Wire, and RTP transfers

export interface ACHTransferRequest {
  amount: number;
  currency: string;
  fromAccount: {
    routingNumber: string;
    accountNumber: string;
    accountType: "checking" | "savings";
  };
  toAccount: {
    routingNumber: string;
    accountNumber: string;
    accountType: "checking" | "savings";
  };
  type: "credit" | "debit";
  secCode: "WEB" | "PPD" | "CCD" | "TEL";
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface WireTransferRequest {
  amount: number;
  currency: string;
  senderBank: {
    routingNumber: string;
    accountNumber: string;
    bankName: string;
    swiftCode?: string;
  };
  beneficiaryBank: {
    routingNumber?: string;
    accountNumber: string;
    bankName: string;
    swiftCode?: string;
    iban?: string;
    country: string;
  };
  beneficiary: {
    name: string;
    address?: string;
  };
  purpose?: string;
  reference?: string;
}

export interface RTPTransferRequest {
  amount: number;
  currency: string;
  fromAccount: {
    routingNumber: string;
    accountNumber: string;
  };
  toAccount: {
    routingNumber: string;
    accountNumber: string;
  };
  message?: string;
}

export interface BankTransferResult {
  success: boolean;
  transferId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "RETURNED";
  estimatedSettlement?: Date;
  errorCode?: string;
  errorMessage?: string;
  traceNumber?: string;
  confirmationNumber?: string;
}

// Validate routing number using checksum algorithm
export function validateRoutingNumber(routingNumber: string): boolean {
  if (!/^\d{9}$/.test(routingNumber)) return false;

  const digits = routingNumber.split("").map(Number);
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8]);

  return checksum % 10 === 0;
}

// Validate account number (basic validation)
export function validateAccountNumber(accountNumber: string): boolean {
  // Account numbers typically 4-17 digits
  return /^\d{4,17}$/.test(accountNumber);
}

// Validate IBAN
export function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned)) return false;

  // Move first 4 chars to end and convert letters to numbers
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numericString = rearranged
    .split("")
    .map((c) => (c >= "A" && c <= "Z" ? (c.charCodeAt(0) - 55).toString() : c))
    .join("");

  // Mod 97 check
  let remainder = 0;
  for (const char of numericString) {
    remainder = (remainder * 10 + parseInt(char)) % 97;
  }

  return remainder === 1;
}

// Validate SWIFT/BIC code
export function validateSWIFT(swift: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift.toUpperCase());
}

// Generate ACH trace number
function generateTraceNumber(): string {
  const date = new Date();
  const julian = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return `${date.getFullYear().toString().slice(-2)}${julian.toString().padStart(3, "0")}${crypto.randomBytes(5).toString("hex").slice(0, 10)}`;
}

// Process ACH transfer
export async function processACHTransfer(
  request: ACHTransferRequest
): Promise<BankTransferResult> {
  const transferId = `ach_${crypto.randomBytes(12).toString("hex")}`;

  // Validate routing numbers
  if (!validateRoutingNumber(request.fromAccount.routingNumber)) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "R04",
      errorMessage: "Invalid sender routing number",
    };
  }

  if (!validateRoutingNumber(request.toAccount.routingNumber)) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "R04",
      errorMessage: "Invalid receiver routing number",
    };
  }

  // Validate account numbers
  if (!validateAccountNumber(request.fromAccount.accountNumber)) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "R03",
      errorMessage: "Invalid sender account number",
    };
  }

  if (!validateAccountNumber(request.toAccount.accountNumber)) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "R03",
      errorMessage: "Invalid receiver account number",
    };
  }

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  // Simulate various ACH return codes (5% failure rate)
  const random = Math.random();
  if (random < 0.02) {
    return {
      success: false,
      transferId,
      status: "RETURNED",
      errorCode: "R01",
      errorMessage: "Insufficient funds",
      traceNumber: generateTraceNumber(),
    };
  }
  if (random < 0.03) {
    return {
      success: false,
      transferId,
      status: "RETURNED",
      errorCode: "R02",
      errorMessage: "Account closed",
      traceNumber: generateTraceNumber(),
    };
  }
  if (random < 0.04) {
    return {
      success: false,
      transferId,
      status: "RETURNED",
      errorCode: "R10",
      errorMessage: "Customer advises unauthorized",
      traceNumber: generateTraceNumber(),
    };
  }
  if (random < 0.05) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "R16",
      errorMessage: "Account frozen",
      traceNumber: generateTraceNumber(),
    };
  }

  // Calculate settlement date (ACH typically settles in 1-2 business days)
  const settlementDate = new Date();
  const daysToAdd = request.type === "credit" ? 1 : 2;
  let addedDays = 0;
  while (addedDays < daysToAdd) {
    settlementDate.setDate(settlementDate.getDate() + 1);
    const dayOfWeek = settlementDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) addedDays++;
  }

  return {
    success: true,
    transferId,
    status: "PROCESSING",
    estimatedSettlement: settlementDate,
    traceNumber: generateTraceNumber(),
  };
}

// Process same-day ACH
export async function processSameDayACH(
  request: ACHTransferRequest
): Promise<BankTransferResult> {
  const result = await processACHTransfer(request);

  if (result.success) {
    // Same-day ACH settles by end of day if submitted before cutoff
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(14, 0, 0, 0); // 2 PM cutoff

    if (now < cutoff) {
      result.estimatedSettlement = new Date();
      result.estimatedSettlement.setHours(17, 0, 0, 0);
    } else {
      // Next business day
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
      }
      nextDay.setHours(17, 0, 0, 0);
      result.estimatedSettlement = nextDay;
    }
  }

  return result;
}

// Process wire transfer
export async function processWireTransfer(
  request: WireTransferRequest
): Promise<BankTransferResult> {
  const transferId = `wire_${crypto.randomBytes(12).toString("hex")}`;
  const isInternational = request.beneficiaryBank.country !== "US";

  // Validate sender routing number
  if (!validateRoutingNumber(request.senderBank.routingNumber)) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "INVALID_ROUTING",
      errorMessage: "Invalid sender routing number",
    };
  }

  // For international wires, validate SWIFT code
  if (isInternational) {
    if (!request.beneficiaryBank.swiftCode) {
      return {
        success: false,
        transferId,
        status: "FAILED",
        errorCode: "MISSING_SWIFT",
        errorMessage: "SWIFT code required for international transfers",
      };
    }
    if (!validateSWIFT(request.beneficiaryBank.swiftCode)) {
      return {
        success: false,
        transferId,
        status: "FAILED",
        errorCode: "INVALID_SWIFT",
        errorMessage: "Invalid SWIFT/BIC code",
      };
    }

    // Validate IBAN for SEPA countries
    if (request.beneficiaryBank.iban && !validateIBAN(request.beneficiaryBank.iban)) {
      return {
        success: false,
        transferId,
        status: "FAILED",
        errorCode: "INVALID_IBAN",
        errorMessage: "Invalid IBAN",
      };
    }
  }

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

  // 3% failure rate for wires
  if (Math.random() < 0.03) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "REJECTED",
      errorMessage: "Transfer rejected by receiving bank",
    };
  }

  // Calculate settlement time
  const settlementDate = new Date();
  if (isInternational) {
    // International wires: 1-5 business days
    const daysToAdd = Math.floor(Math.random() * 4) + 1;
    let addedDays = 0;
    while (addedDays < daysToAdd) {
      settlementDate.setDate(settlementDate.getDate() + 1);
      const dayOfWeek = settlementDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) addedDays++;
    }
  } else {
    // Domestic wires: same day if before cutoff, next business day otherwise
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(17, 0, 0, 0);

    if (now < cutoff) {
      settlementDate.setHours(18, 0, 0, 0);
    } else {
      settlementDate.setDate(settlementDate.getDate() + 1);
      while (settlementDate.getDay() === 0 || settlementDate.getDay() === 6) {
        settlementDate.setDate(settlementDate.getDate() + 1);
      }
    }
  }

  return {
    success: true,
    transferId,
    status: isInternational ? "PROCESSING" : "COMPLETED",
    estimatedSettlement: settlementDate,
    confirmationNumber: `WIRE${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
  };
}

// Process RTP (Real-Time Payments)
export async function processRTPTransfer(
  request: RTPTransferRequest
): Promise<BankTransferResult> {
  const transferId = `rtp_${crypto.randomBytes(12).toString("hex")}`;

  // RTP has a $1M limit
  if (request.amount > 1000000) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "AMOUNT_EXCEEDED",
      errorMessage: "Amount exceeds RTP limit of $1,000,000",
    };
  }

  // Validate routing numbers
  if (!validateRoutingNumber(request.fromAccount.routingNumber)) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "INVALID_ROUTING",
      errorMessage: "Invalid sender routing number",
    };
  }

  if (!validateRoutingNumber(request.toAccount.routingNumber)) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "INVALID_ROUTING",
      errorMessage: "Invalid receiver routing number",
    };
  }

  // Simulate near-instant processing
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

  // 2% failure rate for RTP
  if (Math.random() < 0.02) {
    return {
      success: false,
      transferId,
      status: "FAILED",
      errorCode: "RECIPIENT_NOT_ENABLED",
      errorMessage: "Recipient bank not RTP enabled",
    };
  }

  return {
    success: true,
    transferId,
    status: "COMPLETED",
    estimatedSettlement: new Date(), // Instant settlement
    confirmationNumber: `RTP${Date.now()}`,
  };
}

// Check ACH transfer status
export async function checkACHStatus(
  traceNumber: string
): Promise<{
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "RETURNED" | "UNKNOWN";
  returnCode?: string;
  returnReason?: string;
  settledAt?: Date;
}> {
  // Simulate status check
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 90% completed, 5% processing, 5% returned
  const random = Math.random();
  if (random < 0.9) {
    return {
      status: "COMPLETED",
      settledAt: new Date(Date.now() - Math.random() * 86400000 * 2),
    };
  }
  if (random < 0.95) {
    return { status: "PROCESSING" };
  }
  return {
    status: "RETURNED",
    returnCode: "R01",
    returnReason: "Insufficient funds",
  };
}

// Get bank info from routing number
export function getBankInfo(routingNumber: string): {
  name: string;
  city: string;
  state: string;
} | null {
  // Simulated bank directory lookup
  const banks: Record<string, { name: string; city: string; state: string }> = {
    "021000021": { name: "JPMorgan Chase", city: "New York", state: "NY" },
    "026009593": { name: "Bank of America", city: "New York", state: "NY" },
    "021200025": { name: "Wells Fargo", city: "San Francisco", state: "CA" },
    "071000013": { name: "Citibank", city: "Chicago", state: "IL" },
    "121000358": { name: "Bank of America (West)", city: "San Francisco", state: "CA" },
  };

  return banks[routingNumber] || {
    name: "Community Bank",
    city: "Unknown",
    state: "US",
  };
}

// Calculate wire transfer fee
export function calculateWireFee(
  amount: number,
  isInternational: boolean,
  isIncoming: boolean
): number {
  if (isIncoming) {
    return isInternational ? 15 : 0;
  }

  if (isInternational) {
    // International outgoing: $35-50 base + percentage for large amounts
    const baseFee = 45;
    const percentageFee = amount > 10000 ? (amount - 10000) * 0.001 : 0;
    return Math.min(baseFee + percentageFee, 500); // Cap at $500
  }

  // Domestic outgoing: $25
  return 25;
}

// Calculate ACH fee
export function calculateACHFee(
  amount: number,
  type: "standard" | "sameday",
  direction: "credit" | "debit"
): number {
  if (type === "sameday") {
    // Same-day ACH: $5 flat or 0.5%, whichever is higher
    return Math.max(5, amount * 0.005);
  }

  // Standard ACH: usually free or minimal
  return direction === "debit" ? 0.25 : 0;
}

// Micro-deposit verification
export async function initiateMicroDeposits(
  accountNumber: string,
  routingNumber: string
): Promise<{
  verificationId: string;
  amounts: [number, number];
  expiresAt: Date;
}> {
  const amount1 = Math.floor(Math.random() * 99) + 1; // 0.01 - 0.99
  const amount2 = Math.floor(Math.random() * 99) + 1;

  const verificationId = `mdv_${crypto.randomBytes(12).toString("hex")}`;

  // Store verification data (in production, persist to database)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  return {
    verificationId,
    amounts: [amount1 / 100, amount2 / 100],
    expiresAt,
  };
}

// Verify micro-deposits
export async function verifyMicroDeposits(
  verificationId: string,
  amount1: number,
  amount2: number
): Promise<{ success: boolean; message: string }> {
  // In production, compare against stored amounts
  // For simulation, accept if both amounts are between 0.01 and 0.99
  if (amount1 >= 0.01 && amount1 <= 0.99 && amount2 >= 0.01 && amount2 <= 0.99) {
    return { success: true, message: "Bank account verified successfully" };
  }

  return { success: false, message: "Incorrect deposit amounts" };
}

// Process batch ACH file
export async function processBatchACH(
  transfers: ACHTransferRequest[]
): Promise<{
  batchId: string;
  totalAmount: number;
  successCount: number;
  failureCount: number;
  results: BankTransferResult[];
}> {
  const batchId = `batch_${crypto.randomBytes(8).toString("hex")}`;
  const results: BankTransferResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  let totalAmount = 0;

  for (const transfer of transfers) {
    const result = await processACHTransfer(transfer);
    results.push(result);

    if (result.success) {
      successCount++;
      totalAmount += transfer.amount;
    } else {
      failureCount++;
    }
  }

  return {
    batchId,
    totalAmount,
    successCount,
    failureCount,
    results,
  };
}

// Check if routing number supports RTP
export function isRTPEnabled(routingNumber: string): boolean {
  // Simulated RTP-enabled bank check
  const rtpEnabledPrefixes = ["021", "026", "071", "121", "091"];
  return rtpEnabledPrefixes.some((prefix) => routingNumber.startsWith(prefix));
}

// Get available transfer methods for an account
export function getAvailableTransferMethods(
  routingNumber: string,
  amount: number
): ("ach" | "ach_sameday" | "rtp" | "wire")[] {
  const methods: ("ach" | "ach_sameday" | "rtp" | "wire")[] = ["ach", "ach_sameday", "wire"];

  // RTP only for enabled banks and amounts under $1M
  if (isRTPEnabled(routingNumber) && amount <= 1000000) {
    methods.push("rtp");
  }

  return methods;
}
