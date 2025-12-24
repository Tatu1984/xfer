import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Payment processor simulation - in production, replace with Stripe/Adyen/etc.

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  processorTransactionId: string;
  status: "COMPLETED" | "PENDING" | "FAILED" | "REQUIRES_ACTION";
  errorCode?: string;
  errorMessage?: string;
  authorizationCode?: string;
  avsResult?: string;
  cvvResult?: string;
  networkTransactionId?: string;
  requiresAction?: {
    type: "3ds" | "redirect" | "otp";
    url?: string;
  };
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  status: "COMPLETED" | "PENDING" | "FAILED";
  errorMessage?: string;
}

export interface CardDetails {
  number: string;
  expMonth: number;
  expYear: number;
  cvv: string;
  holderName: string;
}

export interface BankAccountDetails {
  accountNumber: string;
  routingNumber: string;
  accountType: "checking" | "savings";
  accountHolderName: string;
}

// Test card numbers for sandbox
const TEST_CARDS = {
  SUCCESS: ["4242424242424242", "5555555555554444", "378282246310005"],
  DECLINE: ["4000000000000002", "4000000000009995"],
  INSUFFICIENT_FUNDS: ["4000000000009995"],
  REQUIRES_3DS: ["4000000000003220", "4000000000003063"],
  FRAUD: ["4100000000000019"],
  EXPIRED: ["4000000000000069"],
  CVV_FAIL: ["4000000000000127"],
};

// Generate processor transaction ID
function generateProcessorTxId(): string {
  return `pi_${crypto.randomBytes(12).toString("hex")}`;
}

// Simulate card payment processing
export async function processCardPayment(
  amount: number,
  currency: string,
  card: CardDetails,
  metadata?: Record<string, unknown>
): Promise<PaymentResult> {
  const transactionId = crypto.randomUUID();
  const processorTxId = generateProcessorTxId();

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  const cardNumber = card.number.replace(/\s/g, "");

  // Check test card scenarios
  if (TEST_CARDS.DECLINE.includes(cardNumber)) {
    return {
      success: false,
      transactionId,
      processorTransactionId: processorTxId,
      status: "FAILED",
      errorCode: "card_declined",
      errorMessage: "Your card was declined",
    };
  }

  if (TEST_CARDS.INSUFFICIENT_FUNDS.includes(cardNumber)) {
    return {
      success: false,
      transactionId,
      processorTransactionId: processorTxId,
      status: "FAILED",
      errorCode: "insufficient_funds",
      errorMessage: "Insufficient funds",
    };
  }

  if (TEST_CARDS.REQUIRES_3DS.includes(cardNumber)) {
    return {
      success: false,
      transactionId,
      processorTransactionId: processorTxId,
      status: "REQUIRES_ACTION",
      requiresAction: {
        type: "3ds",
        url: `/api/3ds/authenticate?txn=${processorTxId}`,
      },
    };
  }

  if (TEST_CARDS.FRAUD.includes(cardNumber)) {
    return {
      success: false,
      transactionId,
      processorTransactionId: processorTxId,
      status: "FAILED",
      errorCode: "fraud_detected",
      errorMessage: "Transaction flagged as potentially fraudulent",
    };
  }

  if (TEST_CARDS.EXPIRED.includes(cardNumber)) {
    return {
      success: false,
      transactionId,
      processorTransactionId: processorTxId,
      status: "FAILED",
      errorCode: "expired_card",
      errorMessage: "Your card has expired",
    };
  }

  if (TEST_CARDS.CVV_FAIL.includes(cardNumber)) {
    return {
      success: false,
      transactionId,
      processorTransactionId: processorTxId,
      status: "FAILED",
      errorCode: "incorrect_cvc",
      errorMessage: "Security code verification failed",
      cvvResult: "N",
    };
  }

  // Validate card expiration
  const now = new Date();
  const expDate = new Date(card.expYear, card.expMonth - 1);
  if (expDate < now) {
    return {
      success: false,
      transactionId,
      processorTransactionId: processorTxId,
      status: "FAILED",
      errorCode: "expired_card",
      errorMessage: "Your card has expired",
    };
  }

  // Success case
  return {
    success: true,
    transactionId,
    processorTransactionId: processorTxId,
    status: "COMPLETED",
    authorizationCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
    avsResult: "Y",
    cvvResult: "M",
    networkTransactionId: `ntxn_${crypto.randomBytes(8).toString("hex")}`,
  };
}

// Process card authorization (hold funds)
export async function authorizeCard(
  amount: number,
  currency: string,
  card: CardDetails
): Promise<PaymentResult> {
  const result = await processCardPayment(amount, currency, card);
  if (result.success) {
    result.status = "PENDING"; // Authorization holds funds but doesn't capture
  }
  return result;
}

// Capture authorized payment
export async function captureAuthorization(
  authorizationId: string,
  amount?: number
): Promise<PaymentResult> {
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

  return {
    success: true,
    transactionId: crypto.randomUUID(),
    processorTransactionId: authorizationId,
    status: "COMPLETED",
    authorizationCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
  };
}

// Process refund
export async function processRefund(
  originalTransactionId: string,
  amount: number,
  reason?: string
): Promise<RefundResult> {
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  // 95% success rate for refunds
  if (Math.random() < 0.95) {
    return {
      success: true,
      refundId: `re_${crypto.randomBytes(12).toString("hex")}`,
      status: "COMPLETED",
    };
  }

  return {
    success: false,
    refundId: `re_${crypto.randomBytes(12).toString("hex")}`,
    status: "FAILED",
    errorMessage: "Refund could not be processed at this time",
  };
}

// Void authorization
export async function voidAuthorization(authorizationId: string): Promise<RefundResult> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  return {
    success: true,
    refundId: authorizationId,
    status: "COMPLETED",
  };
}

// Tokenize card for future use
export async function tokenizeCard(card: CardDetails): Promise<{
  token: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  fingerprint: string;
}> {
  const cardNumber = card.number.replace(/\s/g, "");
  const last4 = cardNumber.slice(-4);

  // Determine card brand
  let brand = "unknown";
  if (cardNumber.startsWith("4")) brand = "visa";
  else if (cardNumber.startsWith("5") || cardNumber.startsWith("2")) brand = "mastercard";
  else if (cardNumber.startsWith("3")) brand = "amex";
  else if (cardNumber.startsWith("6")) brand = "discover";

  const fingerprint = crypto
    .createHash("sha256")
    .update(cardNumber)
    .digest("hex")
    .slice(0, 16);

  return {
    token: `tok_${crypto.randomBytes(12).toString("hex")}`,
    last4,
    brand,
    expMonth: card.expMonth,
    expYear: card.expYear,
    fingerprint,
  };
}

// Process payment using saved token
export async function processTokenPayment(
  token: string,
  amount: number,
  currency: string
): Promise<PaymentResult> {
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  // 98% success rate for tokenized payments
  if (Math.random() < 0.98) {
    return {
      success: true,
      transactionId: crypto.randomUUID(),
      processorTransactionId: generateProcessorTxId(),
      status: "COMPLETED",
      authorizationCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
    };
  }

  return {
    success: false,
    transactionId: crypto.randomUUID(),
    processorTransactionId: generateProcessorTxId(),
    status: "FAILED",
    errorCode: "payment_failed",
    errorMessage: "Payment could not be processed",
  };
}

// Calculate processing fee
export function calculateProcessingFee(
  amount: number,
  paymentMethod: "card" | "bank" | "wallet",
  isInternational: boolean = false
): { fee: number; percentage: number; fixed: number } {
  let percentage: number;
  let fixed: number;

  switch (paymentMethod) {
    case "card":
      percentage = isInternational ? 0.039 : 0.029; // 2.9% domestic, 3.9% international
      fixed = 0.30;
      break;
    case "bank":
      percentage = 0.008; // 0.8% for ACH
      fixed = 0;
      break;
    case "wallet":
      percentage = 0; // No fee for wallet-to-wallet
      fixed = 0;
      break;
    default:
      percentage = 0.029;
      fixed = 0.30;
  }

  const fee = Math.round((amount * percentage + fixed) * 100) / 100;

  return { fee, percentage, fixed };
}

// Process payout to bank account
export async function processBankPayout(
  amount: number,
  currency: string,
  bankAccount: BankAccountDetails,
  speed: "standard" | "instant" = "standard"
): Promise<{
  success: boolean;
  payoutId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  estimatedArrival?: Date;
  errorMessage?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  const payoutId = `po_${crypto.randomBytes(12).toString("hex")}`;

  // Validate routing number (basic check)
  if (bankAccount.routingNumber.length !== 9) {
    return {
      success: false,
      payoutId,
      status: "FAILED",
      errorMessage: "Invalid routing number",
    };
  }

  // Calculate estimated arrival
  const now = new Date();
  const estimatedArrival = new Date(now);
  if (speed === "instant") {
    estimatedArrival.setMinutes(estimatedArrival.getMinutes() + 30);
  } else {
    // Standard: 1-3 business days
    estimatedArrival.setDate(estimatedArrival.getDate() + 2);
  }

  return {
    success: true,
    payoutId,
    status: speed === "instant" ? "PROCESSING" : "PENDING",
    estimatedArrival,
  };
}

// Get supported payment methods by country
export function getSupportedPaymentMethods(countryCode: string): string[] {
  const methods: Record<string, string[]> = {
    US: ["card", "bank_account", "wallet"],
    GB: ["card", "bank_account", "wallet", "pay_by_bank"],
    EU: ["card", "sepa_debit", "wallet", "ideal", "bancontact", "giropay"],
    CA: ["card", "bank_account", "wallet", "interac"],
    AU: ["card", "bank_account", "wallet", "becs_debit"],
    default: ["card", "wallet"],
  };

  // Map country to region
  const euCountries = ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "PT", "IE", "FI"];
  if (euCountries.includes(countryCode)) {
    return methods.EU;
  }

  return methods[countryCode] || methods.default;
}

// Verify 3DS authentication
export async function verify3DSAuthentication(
  authenticationId: string,
  authenticationValue: string
): Promise<{
  success: boolean;
  status: "authenticated" | "attempted" | "failed";
  eci?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Simulate 90% success rate
  if (Math.random() < 0.9) {
    return {
      success: true,
      status: "authenticated",
      eci: "05", // Fully authenticated
    };
  }

  return {
    success: false,
    status: "failed",
  };
}
