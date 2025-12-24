import { prisma } from "@/lib/prisma";
import { processWebhookRetries } from "./webhook-delivery";

// Background job scheduler infrastructure
// In production, use Bull, Agenda, or similar queue system

export interface Job {
  id: string;
  name: string;
  data: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "retry";
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedReason?: string;
  result?: unknown;
}

export interface JobDefinition {
  name: string;
  handler: (data: Record<string, unknown>) => Promise<unknown>;
  defaultOptions?: {
    priority?: number;
    maxAttempts?: number;
    backoff?: "fixed" | "exponential";
    backoffDelay?: number;
  };
}

// Job registry
const jobRegistry = new Map<string, JobDefinition>();

// In-memory job queue (in production, use Redis/database)
const jobQueue: Job[] = [];
let isProcessing = false;
let processingInterval: NodeJS.Timeout | null = null;

// Register a job handler
export function registerJob(definition: JobDefinition): void {
  jobRegistry.set(definition.name, definition);
}

// Create a new job
export function createJob(
  name: string,
  data: Record<string, unknown>,
  options?: {
    priority?: number;
    runAt?: Date;
    maxAttempts?: number;
  }
): string {
  const definition = jobRegistry.get(name);
  if (!definition) {
    throw new Error(`Unknown job type: ${name}`);
  }

  const job: Job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    name,
    data,
    status: "pending",
    priority: options?.priority ?? definition.defaultOptions?.priority ?? 0,
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? definition.defaultOptions?.maxAttempts ?? 3,
    runAt: options?.runAt ?? new Date(),
  };

  // Insert in priority order
  const insertIndex = jobQueue.findIndex(
    (j) => j.priority < job.priority || (j.priority === job.priority && j.runAt > job.runAt)
  );

  if (insertIndex === -1) {
    jobQueue.push(job);
  } else {
    jobQueue.splice(insertIndex, 0, job);
  }

  return job.id;
}

// Schedule a job to run at a specific time
export function scheduleJob(
  name: string,
  data: Record<string, unknown>,
  runAt: Date,
  options?: { priority?: number; maxAttempts?: number }
): string {
  return createJob(name, data, { ...options, runAt });
}

// Schedule a recurring job
export function scheduleRecurring(
  name: string,
  data: Record<string, unknown>,
  intervalMs: number,
  options?: { priority?: number; maxAttempts?: number }
): string {
  const jobId = createJob(name, { ...data, _recurring: true, _interval: intervalMs }, options);

  return jobId;
}

// Process a single job
async function processJob(job: Job): Promise<void> {
  const definition = jobRegistry.get(job.name);
  if (!definition) {
    job.status = "failed";
    job.failedReason = "Handler not found";
    return;
  }

  job.status = "running";
  job.startedAt = new Date();
  job.attempts++;

  try {
    const result = await definition.handler(job.data);
    job.status = "completed";
    job.completedAt = new Date();
    job.result = result;

    // Handle recurring jobs
    if (job.data._recurring && job.data._interval) {
      const nextRun = new Date(Date.now() + (job.data._interval as number));
      createJob(job.name, job.data, {
        priority: job.priority,
        runAt: nextRun,
        maxAttempts: job.maxAttempts,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (job.attempts < job.maxAttempts) {
      job.status = "retry";
      // Exponential backoff
      const backoffDelay = Math.min(
        (definition.defaultOptions?.backoffDelay ?? 1000) * Math.pow(2, job.attempts - 1),
        60000
      );
      job.runAt = new Date(Date.now() + backoffDelay);
    } else {
      job.status = "failed";
      job.failedReason = errorMessage;
    }
  }
}

// Process all pending jobs
async function processPendingJobs(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    const readyJobs = jobQueue.filter(
      (j) => (j.status === "pending" || j.status === "retry") && j.runAt <= now
    );

    for (const job of readyJobs) {
      await processJob(job);

      // Remove completed/failed jobs from queue (keep for a while for debugging)
      if (job.status === "completed" || job.status === "failed") {
        const index = jobQueue.indexOf(job);
        if (index > -1) {
          setTimeout(() => {
            const currentIndex = jobQueue.indexOf(job);
            if (currentIndex > -1) {
              jobQueue.splice(currentIndex, 1);
            }
          }, 60000); // Remove after 1 minute
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

// Start the job processor
export function startJobProcessor(intervalMs: number = 1000): void {
  if (processingInterval) return;

  processingInterval = setInterval(processPendingJobs, intervalMs);
  console.log("[JobScheduler] Started processing jobs");
}

// Stop the job processor
export function stopJobProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log("[JobScheduler] Stopped processing jobs");
  }
}

// Get job status
export function getJobStatus(jobId: string): Job | undefined {
  return jobQueue.find((j) => j.id === jobId);
}

// Get all jobs by status
export function getJobsByStatus(status: Job["status"]): Job[] {
  return jobQueue.filter((j) => j.status === status);
}

// Cancel a pending job
export function cancelJob(jobId: string): boolean {
  const job = jobQueue.find((j) => j.id === jobId);
  if (job && job.status === "pending") {
    const index = jobQueue.indexOf(job);
    jobQueue.splice(index, 1);
    return true;
  }
  return false;
}

// Get queue statistics
export function getQueueStats(): {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  retry: number;
} {
  return {
    pending: jobQueue.filter((j) => j.status === "pending").length,
    running: jobQueue.filter((j) => j.status === "running").length,
    completed: jobQueue.filter((j) => j.status === "completed").length,
    failed: jobQueue.filter((j) => j.status === "failed").length,
    retry: jobQueue.filter((j) => j.status === "retry").length,
  };
}

// ============================================
// Pre-defined job handlers for the platform
// ============================================

// Settlement processing job
registerJob({
  name: "process_settlements",
  handler: async () => {
    const pendingBatches = await prisma.settlementBatch.findMany({
      where: { status: "PENDING" },
      take: 10,
    });

    let processed = 0;
    for (const batch of pendingBatches) {
      await prisma.settlementBatch.update({
        where: { id: batch.id },
        data: {
          status: "PROCESSING",
          processedAt: new Date(),
        },
      });

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      await prisma.settlementBatch.update({
        where: { id: batch.id },
        data: {
          status: "COMPLETED",
        },
      });

      processed++;
    }

    return { processed };
  },
  defaultOptions: {
    priority: 10,
    maxAttempts: 3,
    backoff: "exponential",
    backoffDelay: 5000,
  },
});

// Webhook retry job
registerJob({
  name: "retry_webhooks",
  handler: async () => {
    const successCount = await processWebhookRetries();
    return { successCount };
  },
  defaultOptions: {
    priority: 5,
    maxAttempts: 1,
  },
});

// Subscription renewal check
registerJob({
  name: "check_subscription_renewals",
  handler: async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { lte: tomorrow },
        cancelledAt: null,
      },
      include: { user: true, plan: true },
    });

    let renewed = 0;
    let failed = 0;

    for (const sub of expiringSubscriptions) {
      try {
        const plan = sub.plan;
        // Process renewal payment
        const wallet = await prisma.wallet.findFirst({
          where: { userId: sub.userId, currency: plan.currency },
        });

        if (wallet && Number(wallet.availableBalance) >= Number(plan.price)) {
          // Deduct from wallet
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { decrement: plan.price },
              availableBalance: { decrement: plan.price },
            },
          });

          // Extend subscription based on plan interval
          const nextPeriodEnd = new Date(sub.currentPeriodEnd);
          if (plan.interval === "month") {
            nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + plan.intervalCount);
          } else if (plan.interval === "year") {
            nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + plan.intervalCount);
          } else if (plan.interval === "week") {
            nextPeriodEnd.setDate(nextPeriodEnd.getDate() + 7 * plan.intervalCount);
          } else {
            nextPeriodEnd.setDate(nextPeriodEnd.getDate() + plan.intervalCount);
          }

          await prisma.subscription.update({
            where: { id: sub.id },
            data: {
              currentPeriodStart: sub.currentPeriodEnd,
              currentPeriodEnd: nextPeriodEnd,
            },
          });

          renewed++;
        } else {
          // Failed to renew - start dunning
          createJob("subscription_dunning", { subscriptionId: sub.id, attempt: 1 });
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { renewed, failed };
  },
  defaultOptions: {
    priority: 8,
    maxAttempts: 3,
  },
});

// Subscription dunning job
registerJob({
  name: "subscription_dunning",
  handler: async (data) => {
    const { subscriptionId, attempt } = data as { subscriptionId: string; attempt: number };

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, plan: true },
    });

    if (!sub || sub.status !== "ACTIVE") {
      return { skipped: true };
    }

    const plan = sub.plan;

    // Try payment again
    const wallet = await prisma.wallet.findFirst({
      where: { userId: sub.userId, currency: plan.currency },
    });

    if (wallet && Number(wallet.availableBalance) >= Number(plan.price)) {
      // Successful retry
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: plan.price },
          availableBalance: { decrement: plan.price },
        },
      });

      return { success: true };
    }

    // Notify user
    await prisma.notification.create({
      data: {
        userId: sub.userId,
        type: "payment",
        title: "Subscription Payment Failed",
        message: `We couldn't process your subscription payment. Please update your payment method.`,
        data: { subscriptionId: sub.id, attempt },
      },
    });

    // Schedule next retry or cancel
    if (attempt < 4) {
      const nextRetry = new Date();
      nextRetry.setDate(nextRetry.getDate() + (attempt === 1 ? 3 : attempt === 2 ? 5 : 7));

      scheduleJob(
        "subscription_dunning",
        { subscriptionId, attempt: attempt + 1 },
        nextRetry
      );
    } else {
      // Cancel subscription after 4 failed attempts
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: "payment_failed",
        },
      });

      await prisma.notification.create({
        data: {
          userId: sub.userId,
          type: "system",
          title: "Subscription Cancelled",
          message: "Your subscription has been cancelled due to payment failure.",
          data: { subscriptionId: sub.id },
        },
      });
    }

    return { attempt, retrying: attempt < 4 };
  },
  defaultOptions: {
    priority: 7,
    maxAttempts: 2,
  },
});

// Dispute auto-escalation
registerJob({
  name: "dispute_auto_escalation",
  handler: async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Find disputes that are OPEN and past the deadline
    const unrespondedDisputes = await prisma.dispute.findMany({
      where: {
        status: "OPEN",
        createdAt: { lte: threeDaysAgo },
      },
    });

    let escalated = 0;

    for (const dispute of unrespondedDisputes) {
      // Only escalate if no seller evidence
      if (dispute.sellerEvidence !== null) continue;

      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "ESCALATED",
        },
      });

      // Notify seller (respondent)
      if (dispute.respondentId) {
        await prisma.notification.create({
          data: {
            userId: dispute.respondentId,
            type: "system",
            title: "Dispute Escalated",
            message: `Dispute ${dispute.id} has been escalated due to no response.`,
            data: { disputeId: dispute.id },
          },
        });
      }

      escalated++;
    }

    // Also auto-resolve disputes past deadline in buyer's favor
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const expiredDisputes = await prisma.dispute.findMany({
      where: {
        status: { in: ["OPEN", "ESCALATED"] },
        createdAt: { lte: sevenDaysAgo },
      },
    });

    let resolved = 0;

    for (const dispute of expiredDisputes) {
      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "RESOLVED_BUYER_FAVOR",
          resolvedAt: new Date(),
          resolution: "Auto-resolved in buyer's favor due to no seller response",
        },
      });

      // Process refund
      if (dispute.transactionId) {
        // Mark original transaction as refunded
        await prisma.transaction.update({
          where: { id: dispute.transactionId },
          data: { status: "REVERSED" },
        });
      }

      resolved++;
    }

    return { escalated, resolved };
  },
  defaultOptions: {
    priority: 6,
    maxAttempts: 3,
  },
});

// Clean up old data
registerJob({
  name: "cleanup_old_data",
  handler: async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Clean up old activity logs
    const deletedLogs = await prisma.activityLog.deleteMany({
      where: { createdAt: { lte: ninetyDaysAgo } },
    });

    // Clean up read notifications older than 30 days
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lte: thirtyDaysAgo },
      },
    });

    // Clean up expired GDPR exports
    const expiredExports = await prisma.gDPRRequest.updateMany({
      where: {
        requestType: "export",
        exportExpiresAt: { lte: new Date() },
        exportUrl: { not: null },
      },
      data: {
        exportUrl: null,
        requestDetails: {},
      },
    });

    return {
      deletedLogs: deletedLogs.count,
      deletedNotifications: deletedNotifications.count,
      expiredExports: expiredExports.count,
    };
  },
  defaultOptions: {
    priority: 1,
    maxAttempts: 2,
  },
});

// Fraud monitoring job
registerJob({
  name: "fraud_monitoring",
  handler: async () => {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    // Find users with unusual activity
    const suspiciousActivity = await prisma.transaction.groupBy({
      by: ["senderId"],
      where: {
        createdAt: { gte: oneHourAgo },
        status: "COMPLETED",
      },
      _count: true,
      _sum: { amount: true },
      having: {
        amount: { _sum: { gte: 10000 } },
      },
    });

    let flagged = 0;

    for (const activity of suspiciousActivity) {
      if (!activity.senderId) continue;

      // Check if user is already under review
      const existingHold = await prisma.transaction.findFirst({
        where: {
          senderId: activity.senderId,
          status: "ON_HOLD",
          createdAt: { gte: oneHourAgo },
        },
      });

      if (!existingHold && activity._count > 10) {
        // Create security alert
        await prisma.notification.create({
          data: {
            userId: activity.senderId,
            type: "security",
            title: "Unusual Account Activity",
            message: "We detected unusual activity on your account. Some transactions may be delayed for review.",
          },
        });

        // Notify compliance team
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
          select: { id: true },
        });

        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: "system",
            title: "Suspicious Activity Alert",
            message: `User ${activity.senderId} flagged for high transaction volume`,
            data: {
              userId: activity.senderId,
              transactionCount: activity._count,
              totalAmount: activity._sum?.amount?.toString(),
            },
          })),
        });

        flagged++;
      }
    }

    return { flagged };
  },
  defaultOptions: {
    priority: 9,
    maxAttempts: 2,
  },
});

// Report generation job
registerJob({
  name: "generate_daily_reports",
  handler: async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get transaction summary
    const transactions = await prisma.transaction.aggregate({
      where: {
        createdAt: { gte: yesterday, lt: today },
        status: "COMPLETED",
      },
      _count: true,
      _sum: { amount: true, fee: true },
    });

    // Get new user count
    const newUsers = await prisma.user.count({
      where: { createdAt: { gte: yesterday, lt: today } },
    });

    // Get dispute count
    const disputes = await prisma.dispute.count({
      where: { createdAt: { gte: yesterday, lt: today } },
    });

    console.log("[DailyReport]", {
      date: yesterday.toISOString().split("T")[0],
      transactions: transactions._count,
      volume: transactions._sum.amount,
      fees: transactions._sum.fee,
      newUsers,
      disputes,
    });

    return {
      date: yesterday.toISOString().split("T")[0],
      transactions: transactions._count,
      volume: transactions._sum.amount?.toString(),
      fees: transactions._sum.fee?.toString(),
      newUsers,
      disputes,
    };
  },
  defaultOptions: {
    priority: 3,
    maxAttempts: 2,
  },
});

// Initialize scheduled jobs
export function initializeScheduledJobs(): void {
  // Process settlements every 5 minutes
  scheduleRecurring("process_settlements", {}, 5 * 60 * 1000, { priority: 10 });

  // Retry webhooks every minute
  scheduleRecurring("retry_webhooks", {}, 60 * 1000, { priority: 5 });

  // Check subscription renewals every hour
  scheduleRecurring("check_subscription_renewals", {}, 60 * 60 * 1000, { priority: 8 });

  // Dispute auto-escalation every 6 hours
  scheduleRecurring("dispute_auto_escalation", {}, 6 * 60 * 60 * 1000, { priority: 6 });

  // Cleanup old data daily at midnight
  const midnight = new Date();
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  scheduleJob("cleanup_old_data", {}, midnight);

  // Fraud monitoring every 30 minutes
  scheduleRecurring("fraud_monitoring", {}, 30 * 60 * 1000, { priority: 9 });

  // Generate daily reports at 1 AM
  const oneAM = new Date();
  oneAM.setDate(oneAM.getDate() + 1);
  oneAM.setHours(1, 0, 0, 0);
  scheduleJob("generate_daily_reports", {}, oneAM);

  console.log("[JobScheduler] Initialized scheduled jobs");
}
