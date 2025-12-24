// Sandbox/Test Mode Utilities
// Enable test mode for development and integration testing

export interface SandboxConfig {
  enabled: boolean;
  testCards: TestCard[];
  simulatedDelay: number;
  failureRate: number;
}

export interface TestCard {
  number: string;
  name: string;
  description: string;
  behavior: "success" | "decline" | "error" | "delay";
}

// Test card numbers for sandbox mode
export const TEST_CARDS: TestCard[] = [
  {
    number: "4111111111111111",
    name: "Success Card",
    description: "Always succeeds",
    behavior: "success",
  },
  {
    number: "4000000000000002",
    name: "Decline Card",
    description: "Always declined",
    behavior: "decline",
  },
  {
    number: "4000000000000069",
    name: "Expired Card",
    description: "Card expired error",
    behavior: "decline",
  },
  {
    number: "4000000000000127",
    name: "CVC Fail Card",
    description: "CVC check fails",
    behavior: "decline",
  },
  {
    number: "4000000000000119",
    name: "Processing Error",
    description: "Processing error occurs",
    behavior: "error",
  },
  {
    number: "4000000000000341",
    name: "3D Secure Card",
    description: "Requires 3D Secure authentication",
    behavior: "delay",
  },
];

// Test bank accounts
export const TEST_BANK_ACCOUNTS = [
  {
    routingNumber: "110000000",
    accountNumber: "000123456789",
    type: "checking",
    description: "Test Checking Account - Success",
    behavior: "success",
  },
  {
    routingNumber: "110000000",
    accountNumber: "000111111116",
    type: "checking",
    description: "Test Checking Account - Failure",
    behavior: "decline",
  },
];

// Check if sandbox mode is enabled
export function isSandboxMode(): boolean {
  return process.env.SANDBOX_MODE === "true" || process.env.NODE_ENV === "development";
}

// Simulate payment processing
export async function simulatePayment(
  cardNumber: string,
  amount: number
): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
  code?: string;
}> {
  // Find matching test card
  const testCard = TEST_CARDS.find((c) => c.number === cardNumber.replace(/\s/g, ""));

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

  if (!testCard) {
    // Default behavior for unknown cards in sandbox
    if (isSandboxMode()) {
      return {
        success: true,
        transactionId: `sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    }
    return { success: false, error: "Card not recognized", code: "card_declined" };
  }

  switch (testCard.behavior) {
    case "success":
      return {
        success: true,
        transactionId: `sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    case "decline":
      return {
        success: false,
        error: "Card was declined",
        code: "card_declined",
      };
    case "error":
      return {
        success: false,
        error: "Processing error occurred",
        code: "processing_error",
      };
    case "delay":
      // Simulate 3DS delay
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return {
        success: true,
        transactionId: `sandbox_3ds_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    default:
      return { success: true, transactionId: `sandbox_${Date.now()}` };
  }
}

// Simulate bank transfer
export async function simulateBankTransfer(
  routingNumber: string,
  accountNumber: string,
  amount: number
): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
}> {
  const testAccount = TEST_BANK_ACCOUNTS.find(
    (a) => a.routingNumber === routingNumber && a.accountNumber === accountNumber
  );

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

  if (!testAccount) {
    if (isSandboxMode()) {
      return {
        success: true,
        transactionId: `sandbox_ach_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    }
    return { success: false, error: "Account not found" };
  }

  if (testAccount.behavior === "success") {
    return {
      success: true,
      transactionId: `sandbox_ach_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  return { success: false, error: "Transfer failed" };
}

// Generate test data
export function generateTestUser(): {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
} {
  const id = Math.random().toString(36).substring(2, 8);
  return {
    email: `test_${id}@sandbox.xfer.com`,
    firstName: "Test",
    lastName: `User_${id}`,
    phone: `+1555${Math.random().toString().slice(2, 9)}`,
  };
}

// Sandbox API response wrapper
export function sandboxResponse<T>(data: T, mode: "sandbox" | "live" = "sandbox"): T & { _sandbox: boolean } {
  return {
    ...data,
    _sandbox: mode === "sandbox",
  };
}

// Validate test mode header
export function validateSandboxHeader(authHeader: string | null): boolean {
  if (!authHeader) return false;

  // Check for test mode API key prefix
  if (authHeader.includes("xfer_test_")) {
    return true;
  }

  // Check for sandbox mode flag
  if (authHeader.includes("sandbox=true")) {
    return true;
  }

  return isSandboxMode();
}

// Sandbox webhook testing
export async function triggerTestWebhook(
  url: string,
  eventType: string,
  testData: Record<string, unknown>
): Promise<{ delivered: boolean; statusCode?: number; error?: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Test": "true",
        "X-Webhook-Signature": "sandbox_signature",
        "X-Webhook-Timestamp": Date.now().toString(),
      },
      body: JSON.stringify({
        id: `test_evt_${Date.now()}`,
        type: eventType,
        createdAt: new Date().toISOString(),
        data: testData,
        _sandbox: true,
      }),
    });

    return {
      delivered: response.ok,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "Delivery failed",
    };
  }
}

// Test data generators
export const testDataGenerators = {
  transaction: () => ({
    id: `test_txn_${Date.now()}`,
    referenceId: `TFR-TEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    amount: Math.floor(Math.random() * 10000) / 100,
    currency: "USD",
    status: "COMPLETED",
    type: "TRANSFER_OUT",
    createdAt: new Date().toISOString(),
  }),

  order: () => ({
    id: `test_ord_${Date.now()}`,
    orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
    total: Math.floor(Math.random() * 50000) / 100,
    currency: "USD",
    status: "CAPTURED",
    items: [
      {
        name: "Test Product",
        quantity: 1,
        price: Math.floor(Math.random() * 10000) / 100,
      },
    ],
    createdAt: new Date().toISOString(),
  }),

  customer: () => {
    const id = Math.random().toString(36).substring(2, 8);
    return {
      id: `test_cus_${Date.now()}`,
      email: `customer_${id}@test.xfer.com`,
      name: `Test Customer ${id}`,
      createdAt: new Date().toISOString(),
    };
  },

  payout: () => ({
    id: `test_po_${Date.now()}`,
    amount: Math.floor(Math.random() * 100000) / 100,
    currency: "USD",
    status: "COMPLETED",
    method: "bank_transfer",
    createdAt: new Date().toISOString(),
  }),
};
