import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  DepositoryAccountSubtype,
  ProcessorTokenCreateRequestProcessorEnum,
} from "plaid";

// Initialize Plaid client
const plaidEnv = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
      "PLAID-SECRET": process.env.PLAID_SECRET || "",
    },
  },
});

// Only create client if credentials are configured
const plaid =
  process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET
    ? new PlaidApi(configuration)
    : null;

// Check if Plaid is configured
export function isPlaidConfigured(): boolean {
  return plaid !== null;
}

// ============================================
// TYPES
// ============================================

export interface LinkTokenOptions {
  userId: string;
  products?: Products[];
  countryCodes?: CountryCode[];
  language?: string;
  redirectUri?: string;
  accountFilters?: {
    depository?: {
      accountSubtypes?: string[];
    };
  };
}

export interface BankAccount {
  accountId: string;
  name: string;
  mask: string;
  type: "checking" | "savings" | "credit" | "loan" | "investment" | "other";
  subtype: string;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    currency: string;
  };
  institution?: {
    id: string;
    name: string;
  };
}

export interface Transaction {
  transactionId: string;
  accountId: string;
  amount: number;
  currency: string;
  date: string;
  name: string;
  merchantName?: string;
  category?: string[];
  pending: boolean;
}

export interface Identity {
  names: string[];
  emails: { data: string; primary: boolean }[];
  phones: { data: string; primary: boolean; type: string }[];
  addresses: {
    data: {
      street: string;
      city: string;
      region: string;
      postalCode: string;
      country: string;
    };
    primary: boolean;
  }[];
}

// ============================================
// LINK TOKEN (for Plaid Link initialization)
// ============================================

export async function createLinkToken(
  options: LinkTokenOptions
): Promise<{ success: boolean; linkToken?: string; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would create link token for user:", options.userId);
    return { success: true, linkToken: `link-sandbox-${Date.now()}` };
  }

  try {
    const subtypeMap: Record<string, DepositoryAccountSubtype> = {
      checking: DepositoryAccountSubtype.Checking,
      savings: DepositoryAccountSubtype.Savings,
    };

    const accountFilters = options.accountFilters?.depository?.accountSubtypes
      ? {
          depository: {
            account_subtypes: options.accountFilters.depository.accountSubtypes
              .map((s) => subtypeMap[s])
              .filter(Boolean),
          },
        }
      : undefined;

    const response = await plaid.linkTokenCreate({
      user: { client_user_id: options.userId },
      client_name: "Xfer",
      products: options.products || [Products.Auth, Products.Transactions],
      country_codes: options.countryCodes || [CountryCode.Us],
      language: options.language || "en",
      redirect_uri: options.redirectUri,
      account_filters: accountFilters,
    });

    return { success: true, linkToken: response.data.link_token };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to create link token:", message);
    return { success: false, error: message };
  }
}

// ============================================
// ACCESS TOKEN (exchange public token)
// ============================================

export async function exchangePublicToken(
  publicToken: string
): Promise<{ success: boolean; accessToken?: string; itemId?: string; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would exchange public token");
    return {
      success: true,
      accessToken: `access-sandbox-${Date.now()}`,
      itemId: `item-sandbox-${Date.now()}`,
    };
  }

  try {
    const response = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });

    return {
      success: true,
      accessToken: response.data.access_token,
      itemId: response.data.item_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to exchange public token:", message);
    return { success: false, error: message };
  }
}

// ============================================
// ACCOUNTS
// ============================================

export async function getAccounts(
  accessToken: string
): Promise<{ success: boolean; accounts?: BankAccount[]; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would get accounts for access token");
    return {
      success: true,
      accounts: [
        {
          accountId: "acc_sandbox_checking",
          name: "Plaid Checking",
          mask: "0000",
          type: "checking",
          subtype: "checking",
          balances: {
            available: 100,
            current: 110,
            limit: null,
            currency: "USD",
          },
          institution: { id: "ins_sandbox", name: "Sandbox Bank" },
        },
        {
          accountId: "acc_sandbox_savings",
          name: "Plaid Savings",
          mask: "1111",
          type: "savings",
          subtype: "savings",
          balances: {
            available: 200,
            current: 210,
            limit: null,
            currency: "USD",
          },
          institution: { id: "ins_sandbox", name: "Sandbox Bank" },
        },
      ],
    };
  }

  try {
    const response = await plaid.accountsGet({ access_token: accessToken });

    const accounts: BankAccount[] = response.data.accounts.map((acc) => ({
      accountId: acc.account_id,
      name: acc.name,
      mask: acc.mask || "",
      type: acc.type as BankAccount["type"],
      subtype: acc.subtype || "",
      balances: {
        available: acc.balances.available,
        current: acc.balances.current,
        limit: acc.balances.limit,
        currency: acc.balances.iso_currency_code || "USD",
      },
    }));

    return { success: true, accounts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to get accounts:", message);
    return { success: false, error: message };
  }
}

// ============================================
// AUTH (for ACH account/routing numbers)
// ============================================

export async function getAuth(
  accessToken: string
): Promise<{
  success: boolean;
  accounts?: Array<{
    accountId: string;
    accountNumber: string;
    routingNumber: string;
    wireRoutingNumber?: string;
  }>;
  error?: string;
}> {
  if (!plaid) {
    console.log("[Plaid Dev] Would get auth for access token");
    return {
      success: true,
      accounts: [
        {
          accountId: "acc_sandbox_checking",
          accountNumber: "1111222233330000",
          routingNumber: "011401533",
        },
      ],
    };
  }

  try {
    const response = await plaid.authGet({ access_token: accessToken });

    const accounts = response.data.numbers.ach.map((num) => ({
      accountId: num.account_id,
      accountNumber: num.account,
      routingNumber: num.routing,
      wireRoutingNumber: num.wire_routing || undefined,
    }));

    return { success: true, accounts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to get auth:", message);
    return { success: false, error: message };
  }
}

// ============================================
// BALANCE
// ============================================

export async function getBalance(
  accessToken: string,
  accountIds?: string[]
): Promise<{
  success: boolean;
  balances?: Array<{
    accountId: string;
    available: number | null;
    current: number | null;
    limit: number | null;
    currency: string;
  }>;
  error?: string;
}> {
  if (!plaid) {
    console.log("[Plaid Dev] Would get balance for access token");
    return {
      success: true,
      balances: [
        {
          accountId: "acc_sandbox_checking",
          available: 100,
          current: 110,
          limit: null,
          currency: "USD",
        },
      ],
    };
  }

  try {
    const response = await plaid.accountsBalanceGet({
      access_token: accessToken,
      options: accountIds ? { account_ids: accountIds } : undefined,
    });

    const balances = response.data.accounts.map((acc) => ({
      accountId: acc.account_id,
      available: acc.balances.available,
      current: acc.balances.current,
      limit: acc.balances.limit,
      currency: acc.balances.iso_currency_code || "USD",
    }));

    return { success: true, balances };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to get balance:", message);
    return { success: false, error: message };
  }
}

// ============================================
// TRANSACTIONS
// ============================================

export async function getTransactions(
  accessToken: string,
  startDate: string,
  endDate: string,
  options?: { accountIds?: string[]; count?: number; offset?: number }
): Promise<{
  success: boolean;
  transactions?: Transaction[];
  totalCount?: number;
  error?: string;
}> {
  if (!plaid) {
    console.log("[Plaid Dev] Would get transactions for access token");
    return {
      success: true,
      transactions: [
        {
          transactionId: "txn_sandbox_1",
          accountId: "acc_sandbox_checking",
          amount: -12.34,
          currency: "USD",
          date: new Date().toISOString().split("T")[0],
          name: "Uber",
          merchantName: "Uber Technologies",
          category: ["Travel", "Taxi"],
          pending: false,
        },
        {
          transactionId: "txn_sandbox_2",
          accountId: "acc_sandbox_checking",
          amount: -5.99,
          currency: "USD",
          date: new Date().toISOString().split("T")[0],
          name: "Netflix",
          merchantName: "Netflix",
          category: ["Entertainment", "Subscription"],
          pending: false,
        },
      ],
      totalCount: 2,
    };
  }

  try {
    const response = await plaid.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        account_ids: options?.accountIds,
        count: options?.count || 100,
        offset: options?.offset || 0,
      },
    });

    const transactions: Transaction[] = response.data.transactions.map((txn) => ({
      transactionId: txn.transaction_id,
      accountId: txn.account_id,
      amount: txn.amount,
      currency: txn.iso_currency_code || "USD",
      date: txn.date,
      name: txn.name,
      merchantName: txn.merchant_name || undefined,
      category: txn.category || undefined,
      pending: txn.pending,
    }));

    return {
      success: true,
      transactions,
      totalCount: response.data.total_transactions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to get transactions:", message);
    return { success: false, error: message };
  }
}

// ============================================
// IDENTITY
// ============================================

export async function getIdentity(
  accessToken: string
): Promise<{ success: boolean; identity?: Identity; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would get identity for access token");
    return {
      success: true,
      identity: {
        names: ["John Doe"],
        emails: [{ data: "john@example.com", primary: true }],
        phones: [{ data: "+15551234567", primary: true, type: "mobile" }],
        addresses: [
          {
            data: {
              street: "123 Main St",
              city: "San Francisco",
              region: "CA",
              postalCode: "94102",
              country: "US",
            },
            primary: true,
          },
        ],
      },
    };
  }

  try {
    const response = await plaid.identityGet({ access_token: accessToken });

    // Get identity from first account
    const accountOwners = response.data.accounts[0]?.owners || [];
    const owner = accountOwners[0];

    if (!owner) {
      return { success: false, error: "No identity data found" };
    }

    const identity: Identity = {
      names: owner.names || [],
      emails:
        owner.emails?.map((e) => ({
          data: e.data,
          primary: e.primary ?? false,
        })) || [],
      phones:
        owner.phone_numbers?.map((p) => ({
          data: p.data,
          primary: p.primary ?? false,
          type: p.type || "unknown",
        })) || [],
      addresses:
        owner.addresses?.map((a) => ({
          data: {
            street: a.data.street || "",
            city: a.data.city || "",
            region: a.data.region || "",
            postalCode: a.data.postal_code || "",
            country: a.data.country || "",
          },
          primary: a.primary ?? false,
        })) || [],
    };

    return { success: true, identity };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to get identity:", message);
    return { success: false, error: message };
  }
}

// ============================================
// INSTITUTION LOOKUP
// ============================================

export async function getInstitution(
  institutionId: string
): Promise<{
  success: boolean;
  institution?: {
    id: string;
    name: string;
    url?: string;
    logo?: string;
    primaryColor?: string;
  };
  error?: string;
}> {
  if (!plaid) {
    console.log("[Plaid Dev] Would get institution:", institutionId);
    return {
      success: true,
      institution: {
        id: institutionId,
        name: "Sandbox Bank",
        url: "https://sandbox.plaid.com",
        primaryColor: "#0052FF",
      },
    };
  }

  try {
    const response = await plaid.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
      options: { include_optional_metadata: true },
    });

    const inst = response.data.institution;

    return {
      success: true,
      institution: {
        id: inst.institution_id,
        name: inst.name,
        url: inst.url || undefined,
        logo: inst.logo || undefined,
        primaryColor: inst.primary_color || undefined,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to get institution:", message);
    return { success: false, error: message };
  }
}

// ============================================
// PROCESSOR TOKEN (for Stripe/Dwolla)
// ============================================

export async function createProcessorToken(
  accessToken: string,
  accountId: string,
  processor: ProcessorTokenCreateRequestProcessorEnum
): Promise<{ success: boolean; processorToken?: string; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would create processor token:", { accountId, processor });
    return { success: true, processorToken: `processor-sandbox-${Date.now()}` };
  }

  try {
    const response = await plaid.processorTokenCreate({
      access_token: accessToken,
      account_id: accountId,
      processor,
    });

    return { success: true, processorToken: response.data.processor_token };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to create processor token:", message);
    return { success: false, error: message };
  }
}

// For Stripe specifically
export async function createStripeToken(
  accessToken: string,
  accountId: string
): Promise<{ success: boolean; stripeToken?: string; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would create Stripe bank account token");
    return { success: true, stripeToken: `btok_sandbox_${Date.now()}` };
  }

  try {
    const response = await plaid.processorStripeBankAccountTokenCreate({
      access_token: accessToken,
      account_id: accountId,
    });

    return { success: true, stripeToken: response.data.stripe_bank_account_token };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to create Stripe token:", message);
    return { success: false, error: message };
  }
}

// ============================================
// ITEM MANAGEMENT
// ============================================

export async function getItem(
  accessToken: string
): Promise<{
  success: boolean;
  item?: {
    itemId: string;
    institutionId: string;
    availableProducts: string[];
    billedProducts: string[];
    consentExpirationTime?: string;
    updateType: string;
  };
  error?: string;
}> {
  if (!plaid) {
    console.log("[Plaid Dev] Would get item for access token");
    return {
      success: true,
      item: {
        itemId: "item_sandbox",
        institutionId: "ins_sandbox",
        availableProducts: ["auth", "transactions", "identity"],
        billedProducts: ["auth"],
        updateType: "background",
      },
    };
  }

  try {
    const response = await plaid.itemGet({ access_token: accessToken });

    return {
      success: true,
      item: {
        itemId: response.data.item.item_id,
        institutionId: response.data.item.institution_id || "",
        availableProducts: response.data.item.available_products || [],
        billedProducts: response.data.item.billed_products || [],
        consentExpirationTime: response.data.item.consent_expiration_time || undefined,
        updateType: response.data.item.update_type || "background",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to get item:", message);
    return { success: false, error: message };
  }
}

export async function removeItem(
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would remove item");
    return { success: true };
  }

  try {
    await plaid.itemRemove({ access_token: accessToken });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to remove item:", message);
    return { success: false, error: message };
  }
}

// ============================================
// WEBHOOKS
// ============================================

export async function updateWebhook(
  accessToken: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!plaid) {
    console.log("[Plaid Dev] Would update webhook:", webhookUrl);
    return { success: true };
  }

  try {
    await plaid.itemWebhookUpdate({
      access_token: accessToken,
      webhook: webhookUrl,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to update webhook:", message);
    return { success: false, error: message };
  }
}

// Sandbox testing functions
export async function sandboxCreatePublicToken(
  institutionId: string = "ins_109508",
  initialProducts: Products[] = [Products.Auth, Products.Transactions]
): Promise<{ success: boolean; publicToken?: string; error?: string }> {
  if (!plaid || plaidEnv !== "sandbox") {
    console.log("[Plaid Dev] Would create sandbox public token");
    return { success: true, publicToken: `public-sandbox-${Date.now()}` };
  }

  try {
    const response = await plaid.sandboxPublicTokenCreate({
      institution_id: institutionId,
      initial_products: initialProducts,
    });

    return { success: true, publicToken: response.data.public_token };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Plaid] Failed to create sandbox public token:", message);
    return { success: false, error: message };
  }
}

// Export the raw Plaid client for advanced usage
export { plaid };
