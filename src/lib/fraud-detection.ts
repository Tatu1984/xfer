import { prisma } from "@/lib/prisma";

export interface FraudCheckResult {
  score: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  signals: FraudSignalData[];
  action: "ALLOW" | "REVIEW" | "BLOCK" | "STEP_UP";
  requiresMfa: boolean;
}

export interface FraudSignalData {
  type: string;
  name: string;
  severity: string;
  score: number;
  details: Record<string, unknown>;
}

// IP Geolocation lookup (simplified - in production use MaxMind or similar)
export async function lookupIPGeolocation(ipAddress: string) {
  let geoData = await prisma.iPGeolocation.findUnique({
    where: { ipAddress },
  });

  if (!geoData) {
    // In production, call external API
    // For now, create placeholder
    geoData = await prisma.iPGeolocation.create({
      data: {
        ipAddress,
        country: "UNKNOWN",
        countryCode: "XX",
        threatLevel: "LOW",
      },
    });
  }

  return geoData;
}

// Check for velocity anomalies
async function checkVelocity(
  userId: string,
  amount: number
): Promise<FraudSignalData[]> {
  const signals: FraudSignalData[] = [];
  const now = new Date();

  // Get recent transaction counts
  const [hourly, daily] = await Promise.all([
    prisma.transaction.count({
      where: {
        senderId: userId,
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    }),
    prisma.transaction.count({
      where: {
        senderId: userId,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Check hourly velocity
  if (hourly >= 10) {
    signals.push({
      type: "velocity",
      name: "HIGH_HOURLY_VELOCITY",
      severity: hourly >= 20 ? "HIGH" : "MEDIUM",
      score: hourly >= 20 ? 30 : 15,
      details: { hourlyCount: hourly, threshold: 10 },
    });
  }

  // Check daily velocity
  if (daily >= 50) {
    signals.push({
      type: "velocity",
      name: "HIGH_DAILY_VELOCITY",
      severity: daily >= 100 ? "HIGH" : "MEDIUM",
      score: daily >= 100 ? 25 : 10,
      details: { dailyCount: daily, threshold: 50 },
    });
  }

  // Check for unusual amount
  const avgAmount = await prisma.transaction.aggregate({
    where: { senderId: userId, status: "COMPLETED" },
    _avg: { amount: true },
  });

  const avg = Number(avgAmount._avg.amount || 0);
  if (avg > 0 && amount > avg * 10) {
    signals.push({
      type: "behavior",
      name: "UNUSUAL_AMOUNT",
      severity: amount > avg * 50 ? "HIGH" : "MEDIUM",
      score: amount > avg * 50 ? 25 : 15,
      details: { amount, averageAmount: avg, ratio: amount / avg },
    });
  }

  return signals;
}

// Check device and location
async function checkDeviceLocation(
  userId: string,
  ipAddress: string,
  deviceId?: string
): Promise<FraudSignalData[]> {
  const signals: FraudSignalData[] = [];

  // Get IP geolocation
  const geoData = await lookupIPGeolocation(ipAddress);

  // Check for VPN/Proxy/Tor
  if (geoData.isVpn || geoData.isProxy || geoData.isTor) {
    signals.push({
      type: "location",
      name: geoData.isTor ? "TOR_EXIT_NODE" : geoData.isVpn ? "VPN_DETECTED" : "PROXY_DETECTED",
      severity: geoData.isTor ? "HIGH" : "MEDIUM",
      score: geoData.isTor ? 30 : 15,
      details: { ipAddress, isTor: geoData.isTor, isVpn: geoData.isVpn, isProxy: geoData.isProxy },
    });
  }

  // Check if IP country matches user country
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true },
  });

  if (user?.country && geoData.countryCode !== "XX" && user.country !== geoData.countryCode) {
    signals.push({
      type: "location",
      name: "COUNTRY_MISMATCH",
      severity: "MEDIUM",
      score: 15,
      details: { userCountry: user.country, ipCountry: geoData.countryCode },
    });
  }

  // Check device
  if (deviceId) {
    const device = await prisma.device.findFirst({
      where: { userId, deviceId },
    });

    if (!device) {
      signals.push({
        type: "device",
        name: "NEW_DEVICE",
        severity: "LOW",
        score: 10,
        details: { deviceId },
      });
    } else if (!device.isTrusted) {
      signals.push({
        type: "device",
        name: "UNTRUSTED_DEVICE",
        severity: "LOW",
        score: 5,
        details: { deviceId, lastUsed: device.lastUsedAt },
      });
    }
  }

  // Get behavioral profile
  const profile = await prisma.behavioralProfile.findUnique({
    where: { userId },
  });

  if (profile) {
    // Check if IP country is typical
    if (!profile.typicalIpCountries.includes(geoData.countryCode)) {
      signals.push({
        type: "behavior",
        name: "ATYPICAL_LOCATION",
        severity: "MEDIUM",
        score: 15,
        details: {
          currentCountry: geoData.countryCode,
          typicalCountries: profile.typicalIpCountries,
        },
      });
    }

    // Check login time anomaly
    const currentHour = new Date().getHours();
    const typicalTimes = profile.typicalLoginTimes as number[] | null;
    if (typicalTimes && typicalTimes.length > 0 && !typicalTimes.includes(currentHour)) {
      signals.push({
        type: "behavior",
        name: "UNUSUAL_TIME",
        severity: "LOW",
        score: 5,
        details: { currentHour, typicalHours: typicalTimes },
      });
    }
  }

  return signals;
}

// Check for network/graph fraud
async function checkNetworkFraud(
  userId: string,
  recipientId?: string
): Promise<FraudSignalData[]> {
  const signals: FraudSignalData[] = [];

  // Get user's email domain
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user?.email) {
    const domain = user.email.split("@")[1];

    // Check if domain is flagged
    const flaggedNetwork = await prisma.fraudNetwork.findUnique({
      where: {
        networkType_identifier: {
          networkType: "email_domain",
          identifier: domain,
        },
      },
    });

    if (flaggedNetwork && flaggedNetwork.riskScore > 0.5) {
      signals.push({
        type: "network",
        name: "FLAGGED_EMAIL_DOMAIN",
        severity: flaggedNetwork.riskScore > 0.8 ? "HIGH" : "MEDIUM",
        score: Math.round(flaggedNetwork.riskScore * 40),
        details: { domain, networkRiskScore: flaggedNetwork.riskScore },
      });
    }
  }

  // Check recipient relationship
  if (recipientId) {
    // Check if first-time recipient
    const previousTxs = await prisma.transaction.count({
      where: {
        senderId: userId,
        receiverId: recipientId,
        status: "COMPLETED",
      },
    });

    if (previousTxs === 0) {
      signals.push({
        type: "network",
        name: "NEW_RECIPIENT",
        severity: "LOW",
        score: 5,
        details: { recipientId },
      });
    }
  }

  return signals;
}

// Main fraud check function
export async function checkFraud(
  userId: string,
  amount: number,
  currency: string,
  ipAddress: string,
  deviceId?: string,
  recipientId?: string
): Promise<FraudCheckResult> {
  const allSignals: FraudSignalData[] = [];

  // Run all checks in parallel
  const [velocitySignals, deviceSignals, networkSignals] = await Promise.all([
    checkVelocity(userId, amount),
    checkDeviceLocation(userId, ipAddress, deviceId),
    checkNetworkFraud(userId, recipientId),
  ]);

  allSignals.push(...velocitySignals, ...deviceSignals, ...networkSignals);

  // Calculate total score
  const totalScore = allSignals.reduce((sum, s) => sum + s.score, 0);

  // Determine risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  let action: "ALLOW" | "REVIEW" | "BLOCK" | "STEP_UP";
  let requiresMfa = false;

  if (totalScore >= 80) {
    riskLevel = "CRITICAL";
    action = "BLOCK";
  } else if (totalScore >= 50) {
    riskLevel = "HIGH";
    action = "REVIEW";
    requiresMfa = true;
  } else if (totalScore >= 25) {
    riskLevel = "MEDIUM";
    action = "STEP_UP";
    requiresMfa = true;
  } else {
    riskLevel = "LOW";
    action = "ALLOW";
  }

  // Store fraud signals
  if (allSignals.length > 0) {
    await prisma.fraudSignal.createMany({
      data: allSignals.map((s) => ({
        userId,
        signalType: s.type,
        signalName: s.name,
        severity: s.severity,
        score: s.score,
        details: s.details as object,
      })),
    });
  }

  return {
    score: totalScore,
    riskLevel,
    signals: allSignals,
    action,
    requiresMfa,
  };
}

// Update behavioral profile based on successful transaction
export async function updateBehavioralProfile(
  userId: string,
  ipAddress: string,
  amount: number
) {
  const geoData = await lookupIPGeolocation(ipAddress);
  const currentHour = new Date().getHours();

  const existing = await prisma.behavioralProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    const typicalTimes = (existing.typicalLoginTimes as number[]) || [];
    const typicalCountries = existing.typicalIpCountries || [];

    // Add current hour if not present
    if (!typicalTimes.includes(currentHour)) {
      typicalTimes.push(currentHour);
      if (typicalTimes.length > 12) typicalTimes.shift(); // Keep last 12
    }

    // Add current country if not present
    if (!typicalCountries.includes(geoData.countryCode)) {
      typicalCountries.push(geoData.countryCode);
      if (typicalCountries.length > 5) typicalCountries.shift();
    }

    // Update transaction amounts
    const amounts = (existing.typicalTransactionAmounts as { min: number; max: number; avg: number }) || {
      min: amount,
      max: amount,
      avg: amount,
    };

    await prisma.behavioralProfile.update({
      where: { userId },
      data: {
        typicalLoginTimes: typicalTimes,
        typicalIpCountries: typicalCountries,
        typicalTransactionAmounts: {
          min: Math.min(amounts.min, amount),
          max: Math.max(amounts.max, amount),
          avg: (amounts.avg + amount) / 2,
        },
        lastUpdated: new Date(),
      },
    });
  } else {
    await prisma.behavioralProfile.create({
      data: {
        userId,
        typicalLoginTimes: [currentHour],
        typicalIpCountries: [geoData.countryCode],
        typicalTransactionAmounts: { min: amount, max: amount, avg: amount },
      },
    });
  }
}
