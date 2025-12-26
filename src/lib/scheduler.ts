import cron, { ScheduledTask } from "node-cron";
import { prisma } from "@/lib/prisma";

// Job registry
interface ScheduledJob {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  lastError?: string;
}

const jobs: Map<string, { job: ScheduledJob; task: ScheduledTask }> = new Map();
let isInitialized = false;

// ============================================
// CORE SCHEDULER
// ============================================

export function registerJob(
  name: string,
  schedule: string,
  task: () => Promise<void>,
  enabled: boolean = true
): void {
  if (jobs.has(name)) {
    console.log(`[Scheduler] Job '${name}' already registered, skipping`);
    return;
  }

  const job: ScheduledJob = {
    name,
    schedule,
    task,
    enabled,
  };

  const cronTask = cron.schedule(
    schedule,
    async () => {
      if (!job.enabled) return;

      console.log(`[Scheduler] Starting job: ${name}`);
      const startTime = Date.now();

      try {
        await task();
        job.lastRun = new Date();
        job.lastError = undefined;
        console.log(
          `[Scheduler] Completed job: ${name} in ${Date.now() - startTime}ms`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        job.lastError = message;
        console.error(`[Scheduler] Job failed: ${name}`, message);
      }
    },
    {
      timezone: "UTC",
    }
  );

  // Start or stop based on enabled flag
  if (!enabled) {
    cronTask.stop();
  }

  jobs.set(name, { job, task: cronTask });
  console.log(`[Scheduler] Registered job: ${name} (${schedule})`);
}

export function startJob(name: string): boolean {
  const entry = jobs.get(name);
  if (!entry) return false;

  entry.job.enabled = true;
  entry.task.start();
  console.log(`[Scheduler] Started job: ${name}`);
  return true;
}

export function stopJob(name: string): boolean {
  const entry = jobs.get(name);
  if (!entry) return false;

  entry.job.enabled = false;
  entry.task.stop();
  console.log(`[Scheduler] Stopped job: ${name}`);
  return true;
}

export function getJobStatus(name: string): ScheduledJob | null {
  const entry = jobs.get(name);
  return entry ? entry.job : null;
}

export function listJobs(): ScheduledJob[] {
  return Array.from(jobs.values()).map((e) => e.job);
}

// Run a job immediately (outside of schedule)
export async function runJobNow(name: string): Promise<boolean> {
  const entry = jobs.get(name);
  if (!entry) return false;

  try {
    await entry.job.task();
    entry.job.lastRun = new Date();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    entry.job.lastError = message;
    return false;
  }
}

// ============================================
// BUILT-IN JOBS
// ============================================

// Process scheduled payments
async function processScheduledPayments(): Promise<void> {
  const now = new Date();

  const duePayments = await prisma.scheduledPayment.findMany({
    where: {
      status: "ACTIVE",
      nextRunDate: { lte: now },
    },
    take: 100, // Process in batches
  });

  console.log(`[Scheduler] Found ${duePayments.length} scheduled payments due`);

  for (const payment of duePayments) {
    try {
      // Create execution record
      await prisma.scheduledPaymentExecution.create({
        data: {
          scheduledPaymentId: payment.id,
          status: "SUCCESS",
          amount: payment.amount,
        },
      });

      // TODO: Actually process the payment using Stripe
      // For now, just simulate
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Calculate next execution date
      const nextDate = calculateNextExecutionDate(
        payment.nextRunDate,
        payment.frequency
      );

      // Check if we've hit max runs
      const newRunCount = payment.runCount + 1;
      const reachedMaxRuns = payment.maxRuns && newRunCount >= payment.maxRuns;
      const pastEndDate = payment.endDate && nextDate > payment.endDate;

      // Update scheduled payment
      await prisma.scheduledPayment.update({
        where: { id: payment.id },
        data: {
          lastRunDate: now,
          nextRunDate: (reachedMaxRuns || pastEndDate) ? payment.nextRunDate : nextDate,
          runCount: newRunCount,
          status: (reachedMaxRuns || pastEndDate) ? "COMPLETED" : "ACTIVE",
        },
      });

      console.log(`[Scheduler] Processed scheduled payment: ${payment.id}`);
    } catch (error) {
      console.error(
        `[Scheduler] Failed to process scheduled payment ${payment.id}:`,
        error
      );

      // Create failed execution record
      await prisma.scheduledPaymentExecution.create({
        data: {
          scheduledPaymentId: payment.id,
          status: "FAILED",
          amount: payment.amount,
          failureReason: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
}

// Subscription dunning - retry failed payments
async function processSubscriptionDunning(): Promise<void> {
  // Find subscriptions with payment issues
  const failedSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "PAST_DUE",
      currentPeriodEnd: { lte: new Date() },
    },
    include: {
      user: true,
      plan: true,
    },
    take: 50,
  });

  console.log(
    `[Scheduler] Found ${failedSubscriptions.length} subscriptions for dunning`
  );

  for (const subscription of failedSubscriptions) {
    try {
      // TODO: Retry payment using Stripe
      console.log(`[Scheduler] Would retry payment for subscription: ${subscription.id}`);

      // For now, just send reminder notification
      await prisma.notification.create({
        data: {
          userId: subscription.userId,
          type: "payment",
          title: "Payment Required",
          message: `Your subscription to ${subscription.plan.name} requires payment. Please update your payment method.`,
          data: {
            subscriptionId: subscription.id,
            planName: subscription.plan.name,
          },
        },
      });
    } catch (error) {
      console.error(
        `[Scheduler] Failed dunning for subscription ${subscription.id}:`,
        error
      );
    }
  }
}

// Check for expiring KYC verifications
async function checkExpiringKYC(): Promise<void> {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringVerifications = await prisma.kYCVerification.findMany({
    where: {
      status: "APPROVED",
      documentExpiryDate: {
        lte: thirtyDaysFromNow,
        gte: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  console.log(
    `[Scheduler] Found ${expiringVerifications.length} expiring KYC documents`
  );

  for (const kyc of expiringVerifications) {
    await prisma.notification.create({
      data: {
        userId: kyc.userId,
        type: "system",
        title: "Document Expiring Soon",
        message:
          "Your identity document is expiring soon. Please update it to maintain full account access.",
        data: {
          expiryDate: kyc.documentExpiryDate?.toISOString(),
        },
      },
    });
  }
}

// Generate daily settlement batches
async function generateSettlementBatches(): Promise<void> {
  // Get completed transactions from yesterday that need settlement
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find completed transactions from yesterday
  const transactions = await prisma.transaction.findMany({
    where: {
      status: "COMPLETED",
      processedAt: {
        gte: yesterday,
        lt: today,
      },
    },
    select: {
      currency: true,
      amount: true,
      fee: true,
    },
  });

  if (transactions.length === 0) {
    console.log("[Scheduler] No transactions to settle");
    return;
  }

  // Group by currency and calculate totals
  const byCurrency = transactions.reduce(
    (acc, tx) => {
      const currency = tx.currency;
      if (!acc[currency]) {
        acc[currency] = { credits: 0, debits: 0, count: 0 };
      }
      acc[currency].credits += Number(tx.amount);
      acc[currency].debits += Number(tx.fee);
      acc[currency].count += 1;
      return acc;
    },
    {} as Record<string, { credits: number; debits: number; count: number }>
  );

  // Log settlement summary (actual batch creation would require company account)
  for (const [currency, totals] of Object.entries(byCurrency)) {
    console.log(
      `[Scheduler] Settlement summary for ${currency}: ${totals.count} transactions, ` +
      `credits: ${totals.credits}, debits: ${totals.debits}, net: ${totals.credits - totals.debits}`
    );
  }
}

// Clean up old data
async function cleanupOldData(): Promise<void> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Delete old rate limit logs
  const deletedRateLimits = await prisma.rateLimitLog.deleteMany({
    where: {
      windowStart: { lt: ninetyDaysAgo },
    },
  });

  // Delete old notifications (read ones older than 90 days)
  const deletedNotifications = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: { lt: ninetyDaysAgo },
    },
  });

  console.log(
    `[Scheduler] Cleanup: Deleted ${deletedRateLimits.count} rate limit logs, ${deletedNotifications.count} notifications`
  );
}

// Process pending webhook deliveries
async function retryFailedWebhooks(): Promise<void> {
  const webhooks = await prisma.webhookDelivery.findMany({
    where: {
      status: "FAILED",
      nextRetryAt: { lte: new Date() },
    },
    take: 50,
  });

  // Filter to only retry those under max attempts
  const retryable = webhooks.filter((w) => w.attemptCount < w.maxAttempts);

  console.log(`[Scheduler] Found ${retryable.length} webhooks to retry`);

  for (const delivery of retryable) {
    try {
      // TODO: Actually retry the webhook delivery
      console.log(`[Scheduler] Would retry webhook: ${delivery.id}`);

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          attemptCount: { increment: 1 },
          status: "PENDING",
          nextRetryAt: new Date(Date.now() + 60000 * Math.pow(2, delivery.attemptCount)),
        },
      });
    } catch (error) {
      console.error(`[Scheduler] Failed to retry webhook ${delivery.id}:`, error);
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateNextExecutionDate(
  current: Date,
  frequency: string
): Date {
  const next = new Date(current);

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BIWEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

// ============================================
// INITIALIZATION
// ============================================

export function initializeScheduler(): void {
  if (isInitialized) {
    console.log("[Scheduler] Already initialized");
    return;
  }

  console.log("[Scheduler] Initializing...");

  // Register all built-in jobs

  // Every minute - check for due scheduled payments
  registerJob(
    "process-scheduled-payments",
    "* * * * *",
    processScheduledPayments
  );

  // Every 15 minutes - subscription dunning
  registerJob(
    "subscription-dunning",
    "*/15 * * * *",
    processSubscriptionDunning
  );

  // Every hour - retry failed webhooks
  registerJob(
    "retry-webhooks",
    "0 * * * *",
    retryFailedWebhooks
  );

  // Daily at 1 AM UTC - check expiring KYC
  registerJob(
    "check-expiring-kyc",
    "0 1 * * *",
    checkExpiringKYC
  );

  // Daily at 2 AM UTC - generate settlement batches
  registerJob(
    "generate-settlements",
    "0 2 * * *",
    generateSettlementBatches
  );

  // Daily at 3 AM UTC - cleanup old data
  registerJob(
    "cleanup-old-data",
    "0 3 * * *",
    cleanupOldData
  );

  isInitialized = true;
  console.log("[Scheduler] Initialized with", jobs.size, "jobs");
}

// Graceful shutdown
export function shutdownScheduler(): void {
  console.log("[Scheduler] Shutting down...");

  for (const [name, entry] of jobs) {
    entry.task.stop();
    console.log(`[Scheduler] Stopped job: ${name}`);
  }

  jobs.clear();
  isInitialized = false;
  console.log("[Scheduler] Shutdown complete");
}

// Export for testing
export { processScheduledPayments, processSubscriptionDunning };
