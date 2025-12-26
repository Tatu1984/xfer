// Structured logging for observability
// In production, replace console with external services like Datadog, Logtail, etc.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  userId?: string;
  requestId?: string;
  transactionId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Configuration
const config = {
  minLevel: (process.env.LOG_LEVEL as LogLevel) || "info",
  pretty: process.env.NODE_ENV !== "production",
};

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================
// CORE LOGGING
// ============================================

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[config.minLevel];
}

function formatEntry(entry: LogEntry): string {
  if (config.pretty) {
    const levelColors: Record<LogLevel, string> = {
      debug: "\x1b[90m", // Gray
      info: "\x1b[36m", // Cyan
      warn: "\x1b[33m", // Yellow
      error: "\x1b[31m", // Red
    };
    const reset = "\x1b[0m";
    const color = levelColors[entry.level];

    let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack.split("\n").slice(1, 4).join("\n  ")}`;
      }
    }

    return output;
  }

  // Structured JSON for production
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  const output = formatEntry(entry);

  switch (level) {
    case "debug":
    case "info":
      console.log(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "error":
      console.error(output);
      break;
  }
}

// ============================================
// PUBLIC API
// ============================================

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, error?: Error, context?: LogContext) =>
    log("error", message, context, error),

  // Convenience methods for common operations
  api: {
    request: (method: string, path: string, context?: LogContext) => {
      log("info", `${method} ${path}`, { ...context, action: "api_request" });
    },
    response: (method: string, path: string, status: number, duration: number, context?: LogContext) => {
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      log(level, `${method} ${path} → ${status}`, {
        ...context,
        action: "api_response",
        status,
        duration,
      });
    },
    error: (method: string, path: string, error: Error, context?: LogContext) => {
      log("error", `${method} ${path} failed`, { ...context, action: "api_error" }, error);
    },
  },

  auth: {
    login: (userId: string, success: boolean, context?: LogContext) => {
      const level = success ? "info" : "warn";
      log(level, success ? "User logged in" : "Login failed", {
        ...context,
        userId,
        action: "auth_login",
        success,
      });
    },
    logout: (userId: string, context?: LogContext) => {
      log("info", "User logged out", { ...context, userId, action: "auth_logout" });
    },
    mfaChallenge: (userId: string, success: boolean, context?: LogContext) => {
      log("info", success ? "MFA verified" : "MFA failed", {
        ...context,
        userId,
        action: "auth_mfa",
        success,
      });
    },
  },

  transaction: {
    created: (transactionId: string, userId: string, amount: number, context?: LogContext) => {
      log("info", "Transaction created", {
        ...context,
        transactionId,
        userId,
        amount,
        action: "transaction_created",
      });
    },
    completed: (transactionId: string, userId: string, context?: LogContext) => {
      log("info", "Transaction completed", {
        ...context,
        transactionId,
        userId,
        action: "transaction_completed",
      });
    },
    failed: (transactionId: string, userId: string, reason: string, context?: LogContext) => {
      log("warn", "Transaction failed", {
        ...context,
        transactionId,
        userId,
        reason,
        action: "transaction_failed",
      });
    },
  },

  fraud: {
    detected: (userId: string, score: number, signals: string[], context?: LogContext) => {
      log("warn", "Fraud signals detected", {
        ...context,
        userId,
        score,
        signals,
        action: "fraud_detected",
      });
    },
    blocked: (userId: string, reason: string, context?: LogContext) => {
      log("error", "Transaction blocked for fraud", {
        ...context,
        userId,
        reason,
        action: "fraud_blocked",
      });
    },
  },

  compliance: {
    alert: (userId: string, alertType: string, severity: string, context?: LogContext) => {
      const level = severity === "CRITICAL" ? "error" : severity === "HIGH" ? "warn" : "info";
      log(level, "Compliance alert triggered", {
        ...context,
        userId,
        alertType,
        severity,
        action: "compliance_alert",
      });
    },
    sarCreated: (userId: string, sarId: string, context?: LogContext) => {
      log("info", "SAR report created", {
        ...context,
        userId,
        sarId,
        action: "sar_created",
      });
    },
  },

  webhook: {
    received: (event: string, webhookId: string, context?: LogContext) => {
      log("info", "Webhook received", {
        ...context,
        event,
        webhookId,
        action: "webhook_received",
      });
    },
    delivered: (webhookId: string, deliveryId: string, context?: LogContext) => {
      log("info", "Webhook delivered", {
        ...context,
        webhookId,
        deliveryId,
        action: "webhook_delivered",
      });
    },
    failed: (webhookId: string, deliveryId: string, error: string, context?: LogContext) => {
      log("warn", "Webhook delivery failed", {
        ...context,
        webhookId,
        deliveryId,
        error,
        action: "webhook_failed",
      });
    },
  },

  scheduler: {
    jobStarted: (jobName: string, context?: LogContext) => {
      log("info", `Scheduled job started: ${jobName}`, {
        ...context,
        jobName,
        action: "job_started",
      });
    },
    jobCompleted: (jobName: string, duration: number, context?: LogContext) => {
      log("info", `Scheduled job completed: ${jobName}`, {
        ...context,
        jobName,
        duration,
        action: "job_completed",
      });
    },
    jobFailed: (jobName: string, error: Error, context?: LogContext) => {
      log("error", `Scheduled job failed: ${jobName}`, { ...context, jobName, action: "job_failed" }, error);
    },
  },
};

// ============================================
// METRICS (for future integration)
// ============================================

interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

const metricsBuffer: Metric[] = [];
const METRICS_FLUSH_INTERVAL = 10000; // 10 seconds

export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string>
): void {
  metricsBuffer.push({
    name,
    value,
    tags,
    timestamp: new Date(),
  });
}

export function incrementCounter(name: string, tags?: Record<string, string>): void {
  recordMetric(name, 1, tags);
}

export function recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void {
  recordMetric(`${name}.duration`, durationMs, tags);
}

// Flush metrics periodically (in production, send to metrics service)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    if (metricsBuffer.length > 0) {
      if (config.pretty) {
        // In dev, just log metrics
        console.log(`[Metrics] ${metricsBuffer.length} metrics recorded`);
      } else {
        // In production, would send to Datadog, etc.
        console.log(JSON.stringify({ metrics: metricsBuffer }));
      }
      metricsBuffer.length = 0;
    }
  }, METRICS_FLUSH_INTERVAL);
}

// ============================================
// REQUEST TRACKING
// ============================================

let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}_${requestCounter}`;
}

// ============================================
// TIMING HELPER
// ============================================

export function createTimer(): { elapsed: () => number } {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
  };
}

// Example usage:
// const timer = createTimer();
// await doSomething();
// logger.info("Operation completed", { duration: timer.elapsed() });

// ============================================
// AUDIT LOG HELPER
// ============================================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function auditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: (details || {}) as unknown as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
      },
    });

    logger.debug("Audit log created", {
      userId,
      action,
      entityType,
      entityId,
    });
  } catch (error) {
    logger.error("Failed to create audit log", error as Error, {
      userId,
      action,
      entityType,
      entityId,
    });
  }
}

export default logger;
