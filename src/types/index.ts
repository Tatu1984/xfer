import type { Role, AccountStatus, KYCStatus, KYBStatus, TransactionType, TransactionStatus, DisputeType, DisputeStatus, RiskLevel } from "@prisma/client";

// Re-export Prisma types
export type { Role, AccountStatus, KYCStatus, KYBStatus, TransactionType, TransactionStatus, DisputeType, DisputeStatus, RiskLevel };

// User types
export interface UserProfile {
  id: string;
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  role: Role;
  status: AccountStatus;
  locale: string;
  timezone: string;
  preferredCurrency: string;
  mfaEnabled: boolean;
  emailVerified?: Date | null;
  phoneVerified?: Date | null;
  createdAt: Date;
}

// Dashboard stats
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingKyc: number;
  totalTransactions: number;
  totalVolume: number;
  openDisputes: number;
  pendingPayouts: number;
  complianceAlerts: number;
}

// Wallet types
export interface WalletBalance {
  currency: string;
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
}

// Transaction types
export interface TransactionSummary {
  id: string;
  referenceId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  description?: string | null;
  createdAt: Date;
  sender?: {
    id: string;
    email: string;
    displayName?: string | null;
  } | null;
  receiver?: {
    id: string;
    email: string;
    displayName?: string | null;
  } | null;
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Navigation
export interface NavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  children?: NavItem[];
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptTerms: boolean;
}

export interface SendMoneyFormData {
  recipient: string;
  amount: number;
  currency: string;
  note?: string;
}
