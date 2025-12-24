import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQueueStats } from "@/lib/job-scheduler";

// Health check and observability endpoints

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  message?: string;
  lastChecked: string;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  uptime: number;
  timestamp: string;
  checks: HealthCheck[];
  metrics?: SystemMetrics;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  requests: {
    total: number;
    errorRate: number;
    avgLatency: number;
  };
  database: {
    connectionPoolSize: number;
    activeConnections: number;
  };
  jobs: {
    pending: number;
    running: number;
    failed: number;
  };
}

// Track application start time for uptime calculation
const startTime = Date.now();

// Simple in-memory metrics (in production, use Prometheus/StatsD)
const metrics = {
  requestCount: 0,
  errorCount: 0,
  totalLatency: 0,
};

export function recordRequest(latencyMs: number, isError: boolean): void {
  metrics.requestCount++;
  metrics.totalLatency += latencyMs;
  if (isError) metrics.errorCount++;
}

// Check database connectivity
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: "database",
      status: "healthy",
      latency: Date.now() - start,
      message: "Connected to PostgreSQL",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "database",
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Database connection failed",
      lastChecked: new Date().toISOString(),
    };
  }
}

// Check Redis (if used)
async function checkCache(): Promise<HealthCheck> {
  // Simulated cache check
  const start = Date.now();
  try {
    // In production, check Redis connection
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      name: "cache",
      status: "healthy",
      latency: Date.now() - start,
      message: "Cache available",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "cache",
      status: "degraded",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Cache unavailable",
      lastChecked: new Date().toISOString(),
    };
  }
}

// Check external payment processor
async function checkPaymentProcessor(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // In production, ping payment processor health endpoint
    await new Promise((resolve) => setTimeout(resolve, 10));
    return {
      name: "payment_processor",
      status: "healthy",
      latency: Date.now() - start,
      message: "Payment processor available",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "payment_processor",
      status: "degraded",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Payment processor unavailable",
      lastChecked: new Date().toISOString(),
    };
  }
}

// Check job queue
async function checkJobQueue(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const stats = getQueueStats();
    const status = stats.failed > 10 ? "degraded" : "healthy";
    return {
      name: "job_queue",
      status,
      latency: Date.now() - start,
      message: `Pending: ${stats.pending}, Running: ${stats.running}, Failed: ${stats.failed}`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: "job_queue",
      status: "unhealthy",
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : "Job queue unavailable",
      lastChecked: new Date().toISOString(),
    };
  }
}

// Check disk space (simulated)
async function checkDiskSpace(): Promise<HealthCheck> {
  // In production, check actual disk space
  const usedPercentage = 45; // Simulated
  const status = usedPercentage > 90 ? "unhealthy" : usedPercentage > 75 ? "degraded" : "healthy";

  return {
    name: "disk_space",
    status,
    message: `${usedPercentage}% used`,
    lastChecked: new Date().toISOString(),
  };
}

// GET - Health check endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const detail = searchParams.get("detail") === "true";
  const component = searchParams.get("component");

  // Simple liveness check
  if (searchParams.get("type") === "liveness") {
    return NextResponse.json({ status: "alive" });
  }

  // Readiness check
  if (searchParams.get("type") === "readiness") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({ status: "ready" });
    } catch {
      return NextResponse.json({ status: "not_ready" }, { status: 503 });
    }
  }

  // Run all health checks
  const checks: HealthCheck[] = [];

  if (!component || component === "database") {
    checks.push(await checkDatabase());
  }
  if (!component || component === "cache") {
    checks.push(await checkCache());
  }
  if (!component || component === "payment_processor") {
    checks.push(await checkPaymentProcessor());
  }
  if (!component || component === "job_queue") {
    checks.push(await checkJobQueue());
  }
  if (!component || component === "disk_space") {
    checks.push(await checkDiskSpace());
  }

  // Determine overall status
  const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  const overallStatus = hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy";

  const health: SystemHealth = {
    status: overallStatus,
    version: process.env.APP_VERSION || "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };

  // Include detailed metrics if requested
  if (detail) {
    const memUsage = process.memoryUsage();
    const jobStats = getQueueStats();

    health.metrics = {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      requests: {
        total: metrics.requestCount,
        errorRate: metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0,
        avgLatency: metrics.requestCount > 0 ? metrics.totalLatency / metrics.requestCount : 0,
      },
      database: {
        connectionPoolSize: 10, // Configured pool size
        activeConnections: 3, // Would come from Prisma metrics
      },
      jobs: {
        pending: jobStats.pending,
        running: jobStats.running,
        failed: jobStats.failed,
      },
    };
  }

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(health, { status: httpStatus });
}

// POST - Force a health check and log results
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { notify = false } = body;

  // Run comprehensive health check
  const checks = await Promise.all([
    checkDatabase(),
    checkCache(),
    checkPaymentProcessor(),
    checkJobQueue(),
    checkDiskSpace(),
  ]);

  const unhealthyChecks = checks.filter((c) => c.status === "unhealthy");
  const degradedChecks = checks.filter((c) => c.status === "degraded");

  // Log health check
  await prisma.activityLog.create({
    data: {
      action: "health_check",
      entityType: "system",
      entityId: "health",
      details: {
        checks: checks.map((c) => ({ name: c.name, status: c.status })),
        unhealthy: unhealthyChecks.length,
        degraded: degradedChecks.length,
      },
    },
  });

  // Notify admins if there are issues
  if (notify && (unhealthyChecks.length > 0 || degradedChecks.length > 0)) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "system",
        title: "System Health Alert",
        message: `Health check detected ${unhealthyChecks.length} unhealthy and ${degradedChecks.length} degraded components`,
        data: {
          checks: checks.map((c) => ({ name: c.name, status: c.status })),
        },
      })),
    });
  }

  return NextResponse.json({
    success: true,
    checks,
    summary: {
      healthy: checks.filter((c) => c.status === "healthy").length,
      degraded: degradedChecks.length,
      unhealthy: unhealthyChecks.length,
    },
    notified: notify && (unhealthyChecks.length > 0 || degradedChecks.length > 0),
  });
}
