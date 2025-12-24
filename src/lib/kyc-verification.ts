import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// KYC verification service simulation

export interface IdentityVerificationRequest {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn?: string; // Last 4 or full
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
}

export interface DocumentVerificationRequest {
  userId: string;
  documentType: "passport" | "drivers_license" | "national_id" | "residence_permit";
  documentNumber?: string;
  documentFrontUrl: string;
  documentBackUrl?: string;
  selfieUrl?: string;
  country: string;
  expiryDate?: string;
}

export interface BusinessVerificationRequest {
  businessId: string;
  businessName: string;
  businessType: "sole_proprietor" | "llc" | "corporation" | "partnership" | "nonprofit";
  ein?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  incorporationDate?: string;
  website?: string;
  industry?: string;
  beneficialOwners?: Array<{
    name: string;
    dateOfBirth: string;
    ssn?: string;
    ownershipPercentage: number;
  }>;
}

export interface VerificationResult {
  success: boolean;
  verificationId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "IN_REVIEW";
  score?: number;
  checks: VerificationCheck[];
  riskSignals?: string[];
  requiredActions?: string[];
}

export interface VerificationCheck {
  type: string;
  status: "PASSED" | "FAILED" | "WARNING" | "NOT_AVAILABLE";
  details?: string;
}

// Verify identity through data providers
export async function verifyIdentity(
  request: IdentityVerificationRequest
): Promise<VerificationResult> {
  const verificationId = `idv_${crypto.randomBytes(12).toString("hex")}`;
  const checks: VerificationCheck[] = [];
  const riskSignals: string[] = [];
  let score = 100;

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

  // Check 1: Name validation
  const nameValid = /^[a-zA-Z\s'-]+$/.test(request.firstName) && /^[a-zA-Z\s'-]+$/.test(request.lastName);
  checks.push({
    type: "name_validation",
    status: nameValid ? "PASSED" : "FAILED",
    details: nameValid ? "Name format valid" : "Invalid characters in name",
  });
  if (!nameValid) score -= 30;

  // Check 2: Date of birth validation
  const dob = new Date(request.dateOfBirth);
  const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  const ageValid = age >= 18 && age <= 120;
  checks.push({
    type: "age_verification",
    status: ageValid ? "PASSED" : "FAILED",
    details: ageValid ? `Age verified: ${age}` : "Age requirement not met",
  });
  if (!ageValid) score -= 50;

  // Check 3: Address validation
  const addressValid = request.address.postalCode.length >= 5 && request.address.city.length >= 2;
  checks.push({
    type: "address_validation",
    status: addressValid ? "PASSED" : "WARNING",
    details: addressValid ? "Address format valid" : "Address may be incomplete",
  });
  if (!addressValid) score -= 10;

  // Check 4: SSN verification (simulated)
  if (request.ssn) {
    const ssnFormat = /^\d{4}$/.test(request.ssn) || /^\d{3}-?\d{2}-?\d{4}$/.test(request.ssn);
    checks.push({
      type: "ssn_verification",
      status: ssnFormat ? "PASSED" : "FAILED",
      details: ssnFormat ? "SSN format valid" : "Invalid SSN format",
    });
    if (!ssnFormat) score -= 20;
  }

  // Check 5: OFAC/Sanctions screening (simulated)
  const sanctionsCheck = Math.random() > 0.01; // 1% hit rate for simulation
  checks.push({
    type: "sanctions_screening",
    status: sanctionsCheck ? "PASSED" : "FAILED",
    details: sanctionsCheck ? "No sanctions matches" : "Potential sanctions match found",
  });
  if (!sanctionsCheck) {
    score = 0;
    riskSignals.push("SANCTIONS_MATCH");
  }

  // Check 6: PEP (Politically Exposed Person) screening
  const pepCheck = Math.random() > 0.02; // 2% hit rate
  checks.push({
    type: "pep_screening",
    status: pepCheck ? "PASSED" : "WARNING",
    details: pepCheck ? "No PEP matches" : "Potential PEP match",
  });
  if (!pepCheck) {
    score -= 30;
    riskSignals.push("PEP_MATCH");
  }

  // Check 7: Phone verification
  if (request.phone) {
    const phoneValid = /^\+?[\d\s-()]{10,}$/.test(request.phone);
    checks.push({
      type: "phone_verification",
      status: phoneValid ? "PASSED" : "WARNING",
      details: phoneValid ? "Phone format valid" : "Unable to verify phone",
    });
  }

  // Check 8: Email domain check
  if (request.email) {
    const disposableEmails = ["tempmail.com", "throwaway.com", "fakeinbox.com"];
    const domain = request.email.split("@")[1]?.toLowerCase();
    const isDisposable = disposableEmails.includes(domain);
    checks.push({
      type: "email_verification",
      status: isDisposable ? "WARNING" : "PASSED",
      details: isDisposable ? "Disposable email detected" : "Email domain verified",
    });
    if (isDisposable) {
      score -= 15;
      riskSignals.push("DISPOSABLE_EMAIL");
    }
  }

  // Determine final status
  let status: "APPROVED" | "REJECTED" | "IN_REVIEW" | "PENDING";
  if (score >= 80) {
    status = "APPROVED";
  } else if (score >= 50) {
    status = "IN_REVIEW";
  } else {
    status = "REJECTED";
  }

  // Update or create KYC verification record
  await prisma.kYCVerification.upsert({
    where: { userId: request.userId },
    update: {
      status,
      addressLine1: request.address.line1,
      addressLine2: request.address.line2 || null,
      city: request.address.city,
      state: request.address.state,
      postalCode: request.address.postalCode,
      country: request.address.country,
      addressVerified: addressValid,
      sanctionsChecked: true,
      pepChecked: true,
      lastScreeningDate: new Date(),
      verifiedAt: status === "APPROVED" ? new Date() : null,
      level: status === "APPROVED" ? 1 : 0,
    },
    create: {
      userId: request.userId,
      status,
      addressLine1: request.address.line1,
      addressLine2: request.address.line2 || null,
      city: request.address.city,
      state: request.address.state,
      postalCode: request.address.postalCode,
      country: request.address.country,
      addressVerified: addressValid,
      sanctionsChecked: true,
      pepChecked: true,
      lastScreeningDate: new Date(),
      verifiedAt: status === "APPROVED" ? new Date() : null,
      level: status === "APPROVED" ? 1 : 0,
    },
  });

  return {
    success: status === "APPROVED",
    verificationId,
    status,
    score,
    checks,
    riskSignals,
    requiredActions: status === "IN_REVIEW" ? ["manual_review", "additional_documents"] : undefined,
  };
}

// Verify document (ID, passport, etc.)
export async function verifyDocument(
  request: DocumentVerificationRequest
): Promise<VerificationResult> {
  const verificationId = `doc_${crypto.randomBytes(12).toString("hex")}`;
  const checks: VerificationCheck[] = [];
  const riskSignals: string[] = [];
  let score = 100;

  // Simulate processing delay (document analysis takes longer)
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Check 1: Document present
  checks.push({
    type: "document_present",
    status: request.documentFrontUrl ? "PASSED" : "FAILED",
    details: request.documentFrontUrl ? "Document image received" : "Document image missing",
  });
  if (!request.documentFrontUrl) score -= 100;

  // Check 2: Document type validation
  const validTypes = ["passport", "drivers_license", "national_id", "residence_permit"];
  checks.push({
    type: "document_type",
    status: validTypes.includes(request.documentType) ? "PASSED" : "FAILED",
    details: `Document type: ${request.documentType}`,
  });

  // Check 3: Image quality (simulated)
  const qualityScore = 0.7 + Math.random() * 0.3; // 70-100%
  checks.push({
    type: "image_quality",
    status: qualityScore > 0.8 ? "PASSED" : qualityScore > 0.6 ? "WARNING" : "FAILED",
    details: `Quality score: ${Math.round(qualityScore * 100)}%`,
  });
  if (qualityScore < 0.6) score -= 30;

  // Check 4: Document authenticity (simulated)
  const authenticityScore = Math.random() > 0.05 ? 0.85 + Math.random() * 0.15 : 0.3 + Math.random() * 0.3;
  checks.push({
    type: "authenticity",
    status: authenticityScore > 0.7 ? "PASSED" : "FAILED",
    details: `Authenticity score: ${Math.round(authenticityScore * 100)}%`,
  });
  if (authenticityScore < 0.7) {
    score -= 40;
    riskSignals.push("POTENTIAL_FRAUD");
  }

  // Check 5: Expiration check (simulated)
  const isExpired = Math.random() < 0.05; // 5% expired
  checks.push({
    type: "expiration",
    status: isExpired ? "FAILED" : "PASSED",
    details: isExpired ? "Document appears expired" : "Document not expired",
  });
  if (isExpired) score -= 50;

  // Check 6: Face detection (if selfie provided)
  let faceMatchScore = 0;
  let livenessScore = 0;
  if (request.selfieUrl) {
    faceMatchScore = Math.random() > 0.1 ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;
    checks.push({
      type: "face_match",
      status: faceMatchScore > 0.7 ? "PASSED" : "FAILED",
      details: `Face match score: ${Math.round(faceMatchScore * 100)}%`,
    });
    if (faceMatchScore < 0.7) {
      score -= 30;
      riskSignals.push("FACE_MISMATCH");
    }

    // Liveness check
    livenessScore = Math.random() > 0.05 ? 0.85 + Math.random() * 0.15 : 0.4;
    checks.push({
      type: "liveness",
      status: livenessScore > 0.7 ? "PASSED" : "FAILED",
      details: livenessScore > 0.7 ? "Liveness verified" : "Liveness check failed",
    });
    if (livenessScore < 0.7) {
      score -= 30;
      riskSignals.push("LIVENESS_FAILED");
    }
  }

  // Check 7: Country verification
  const supportedCountries = ["US", "CA", "GB", "DE", "FR", "AU", "JP"];
  checks.push({
    type: "country_support",
    status: supportedCountries.includes(request.country) ? "PASSED" : "WARNING",
    details: supportedCountries.includes(request.country)
      ? "Country supported"
      : "Limited verification for this country",
  });

  // Determine final status
  let status: "APPROVED" | "REJECTED" | "IN_REVIEW" | "PENDING";
  if (score >= 80) {
    status = "APPROVED";
  } else if (score >= 50) {
    status = "IN_REVIEW";
  } else {
    status = "REJECTED";
  }

  // Update or create KYC verification record
  await prisma.kYCVerification.upsert({
    where: { userId: request.userId },
    update: {
      status,
      documentType: request.documentType,
      documentNumber: request.documentNumber || null,
      documentCountry: request.country,
      documentFrontUrl: request.documentFrontUrl,
      documentBackUrl: request.documentBackUrl || null,
      documentExpiryDate: request.expiryDate ? new Date(request.expiryDate) : null,
      selfieUrl: request.selfieUrl || null,
      faceMatchScore: faceMatchScore > 0 ? faceMatchScore : null,
      livenessScore: livenessScore > 0 ? livenessScore : null,
      verifiedAt: status === "APPROVED" ? new Date() : null,
      level: status === "APPROVED" ? 2 : undefined,
    },
    create: {
      userId: request.userId,
      status,
      documentType: request.documentType,
      documentNumber: request.documentNumber || null,
      documentCountry: request.country,
      documentFrontUrl: request.documentFrontUrl,
      documentBackUrl: request.documentBackUrl || null,
      documentExpiryDate: request.expiryDate ? new Date(request.expiryDate) : null,
      selfieUrl: request.selfieUrl || null,
      faceMatchScore: faceMatchScore > 0 ? faceMatchScore : null,
      livenessScore: livenessScore > 0 ? livenessScore : null,
      verifiedAt: status === "APPROVED" ? new Date() : null,
      level: status === "APPROVED" ? 2 : 0,
    },
  });

  return {
    success: status === "APPROVED",
    verificationId,
    status,
    score,
    checks,
    riskSignals,
    requiredActions:
      status === "IN_REVIEW"
        ? ["manual_review"]
        : status === "REJECTED"
          ? ["retry_with_better_image"]
          : undefined,
  };
}

// Verify business (KYB - Know Your Business)
export async function verifyBusiness(
  request: BusinessVerificationRequest
): Promise<VerificationResult> {
  const verificationId = `biz_${crypto.randomBytes(12).toString("hex")}`;
  const checks: VerificationCheck[] = [];
  const riskSignals: string[] = [];
  let score = 100;

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1500));

  // Check 1: Business name validation
  const nameValid = request.businessName.length >= 2 && request.businessName.length <= 200;
  checks.push({
    type: "business_name",
    status: nameValid ? "PASSED" : "FAILED",
    details: nameValid ? "Business name valid" : "Invalid business name",
  });
  if (!nameValid) score -= 20;

  // Check 2: EIN verification (simulated)
  if (request.ein) {
    const einValid = /^\d{2}-?\d{7}$/.test(request.ein);
    checks.push({
      type: "ein_verification",
      status: einValid ? "PASSED" : "FAILED",
      details: einValid ? "EIN format valid" : "Invalid EIN format",
    });
    if (!einValid) score -= 30;
  } else if (request.businessType !== "sole_proprietor") {
    checks.push({
      type: "ein_verification",
      status: "WARNING",
      details: "EIN not provided",
    });
    score -= 10;
  }

  // Check 3: Business address verification
  const addressValid = request.address.postalCode.length >= 5;
  checks.push({
    type: "address_verification",
    status: addressValid ? "PASSED" : "WARNING",
    details: addressValid ? "Address verified" : "Address verification pending",
  });

  // Check 4: Secretary of State lookup (simulated)
  if (request.businessType !== "sole_proprietor") {
    const sosMatch = Math.random() > 0.1;
    checks.push({
      type: "sos_lookup",
      status: sosMatch ? "PASSED" : "WARNING",
      details: sosMatch ? "Business found in state records" : "Unable to verify with SOS",
    });
    if (!sosMatch) score -= 15;
  }

  // Check 5: Website verification
  if (request.website) {
    const websiteValid = /^https?:\/\/.+\..+/.test(request.website);
    checks.push({
      type: "website_verification",
      status: websiteValid ? "PASSED" : "WARNING",
      details: websiteValid ? "Website accessible" : "Unable to verify website",
    });
  }

  // Check 6: Industry risk check
  const highRiskIndustries = ["gambling", "adult", "crypto", "firearms", "tobacco"];
  const isHighRisk = highRiskIndustries.includes(request.industry?.toLowerCase() || "");
  checks.push({
    type: "industry_risk",
    status: isHighRisk ? "WARNING" : "PASSED",
    details: isHighRisk ? "High-risk industry detected" : "Industry risk acceptable",
  });
  if (isHighRisk) {
    score -= 20;
    riskSignals.push("HIGH_RISK_INDUSTRY");
  }

  // Check 7: Beneficial owner verification
  if (request.beneficialOwners && request.beneficialOwners.length > 0) {
    let ownershipTotal = 0;
    let ownersVerified = 0;

    for (const owner of request.beneficialOwners) {
      ownershipTotal += owner.ownershipPercentage;
      if (owner.name && owner.dateOfBirth) ownersVerified++;
    }

    const ownershipValid = ownershipTotal <= 100;
    checks.push({
      type: "beneficial_owners",
      status: ownershipValid && ownersVerified === request.beneficialOwners.length ? "PASSED" : "WARNING",
      details: `${ownersVerified}/${request.beneficialOwners.length} owners verified, ${ownershipTotal}% ownership documented`,
    });

    if (!ownershipValid || ownersVerified < request.beneficialOwners.length) {
      score -= 15;
    }
  } else if (request.businessType !== "sole_proprietor") {
    checks.push({
      type: "beneficial_owners",
      status: "WARNING",
      details: "Beneficial owners not documented",
    });
    score -= 10;
  }

  // Check 8: OFAC screening for business
  const sanctionsCheck = Math.random() > 0.005;
  checks.push({
    type: "sanctions_screening",
    status: sanctionsCheck ? "PASSED" : "FAILED",
    details: sanctionsCheck ? "No sanctions matches" : "Potential sanctions match",
  });
  if (!sanctionsCheck) {
    score = 0;
    riskSignals.push("BUSINESS_SANCTIONS_MATCH");
  }

  // Determine final status
  let kybStatus: "APPROVED" | "REJECTED" | "IN_REVIEW" | "PENDING";
  if (score >= 75) {
    kybStatus = "APPROVED";
  } else if (score >= 50) {
    kybStatus = "IN_REVIEW";
  } else {
    kybStatus = "REJECTED";
  }

  // Update Business KYB status
  await prisma.business.update({
    where: { id: request.businessId },
    data: {
      kybStatus,
      legalName: request.businessName,
      taxId: request.ein || null,
      businessType: request.businessType,
      website: request.website || null,
      industry: request.industry || null,
      addressLine1: request.address.line1,
      addressLine2: request.address.line2 || null,
      city: request.address.city,
      state: request.address.state,
      postalCode: request.address.postalCode,
      country: request.address.country,
      verifiedAt: kybStatus === "APPROVED" ? new Date() : null,
    },
  });

  return {
    success: kybStatus === "APPROVED",
    verificationId,
    status: kybStatus,
    score,
    checks,
    riskSignals,
    requiredActions:
      kybStatus === "IN_REVIEW"
        ? ["provide_additional_documents", "verify_beneficial_owners"]
        : undefined,
  };
}

// Get verification status
export async function getVerificationStatus(userId: string): Promise<{
  identityVerified: boolean;
  documentVerified: boolean;
  businessVerified: boolean;
  overallStatus: "UNVERIFIED" | "PENDING" | "PARTIAL" | "VERIFIED";
  kycLevel: number;
  verification: {
    status: string;
    documentType?: string;
    verifiedAt?: Date;
  } | null;
}> {
  const kyc = await prisma.kYCVerification.findUnique({
    where: { userId },
  });

  const business = await prisma.business.findUnique({
    where: { userId },
    select: { kybStatus: true, verifiedAt: true },
  });

  const identityVerified = kyc?.addressVerified === true && kyc?.status === "APPROVED";
  const documentVerified = kyc?.documentType !== null && kyc?.status === "APPROVED";
  const businessVerified = business?.kybStatus === "APPROVED";

  let overallStatus: "UNVERIFIED" | "PENDING" | "PARTIAL" | "VERIFIED";
  if (identityVerified && documentVerified) {
    overallStatus = "VERIFIED";
  } else if (identityVerified || documentVerified) {
    overallStatus = "PARTIAL";
  } else if (kyc?.status === "PENDING" || kyc?.status === "IN_REVIEW") {
    overallStatus = "PENDING";
  } else {
    overallStatus = "UNVERIFIED";
  }

  return {
    identityVerified,
    documentVerified,
    businessVerified,
    overallStatus,
    kycLevel: kyc?.level || 0,
    verification: kyc
      ? {
          status: kyc.status,
          documentType: kyc.documentType || undefined,
          verifiedAt: kyc.verifiedAt || undefined,
        }
      : null,
  };
}

// Calculate user tier based on verification
export async function calculateUserTier(userId: string): Promise<{
  tier: "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
  limits: {
    dailyTransactionLimit: number;
    monthlyTransactionLimit: number;
    singleTransactionLimit: number;
    withdrawalLimit: number;
  };
}> {
  const status = await getVerificationStatus(userId);

  // Get user's transaction volume
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const volume = await prisma.transaction.aggregate({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
      createdAt: { gte: thirtyDaysAgo },
      status: "COMPLETED",
    },
    _sum: { amount: true },
  });

  const monthlyVolume = Number(volume._sum.amount || 0);

  // Determine tier
  let tier: "BASIC" | "STANDARD" | "PREMIUM" | "ENTERPRISE";

  if (status.overallStatus === "VERIFIED" && monthlyVolume > 100000) {
    tier = "ENTERPRISE";
  } else if (status.overallStatus === "VERIFIED") {
    tier = "PREMIUM";
  } else if (status.overallStatus === "PARTIAL") {
    tier = "STANDARD";
  } else {
    tier = "BASIC";
  }

  // Define limits by tier
  const tierLimits = {
    BASIC: {
      dailyTransactionLimit: 500,
      monthlyTransactionLimit: 2000,
      singleTransactionLimit: 250,
      withdrawalLimit: 500,
    },
    STANDARD: {
      dailyTransactionLimit: 5000,
      monthlyTransactionLimit: 25000,
      singleTransactionLimit: 2500,
      withdrawalLimit: 5000,
    },
    PREMIUM: {
      dailyTransactionLimit: 25000,
      monthlyTransactionLimit: 100000,
      singleTransactionLimit: 10000,
      withdrawalLimit: 25000,
    },
    ENTERPRISE: {
      dailyTransactionLimit: 100000,
      monthlyTransactionLimit: 500000,
      singleTransactionLimit: 50000,
      withdrawalLimit: 100000,
    },
  };

  return {
    tier,
    limits: tierLimits[tier],
  };
}

// Re-verify user (periodic re-verification)
export async function scheduleReverification(
  userId: string,
  reason: "periodic" | "suspicious_activity" | "limit_increase" | "manual"
): Promise<{ scheduled: boolean; nextVerificationDate: Date }> {
  const nextDate = new Date();

  switch (reason) {
    case "periodic":
      nextDate.setFullYear(nextDate.getFullYear() + 1); // Annual
      break;
    case "suspicious_activity":
      // Immediate
      break;
    case "limit_increase":
      nextDate.setDate(nextDate.getDate() + 1); // Next day
      break;
    case "manual":
      nextDate.setDate(nextDate.getDate() + 7); // Week
      break;
  }

  // Create notification for user
  await prisma.notification.create({
    data: {
      userId,
      type: "system",
      title: "Verification Required",
      message:
        reason === "suspicious_activity"
          ? "Please verify your identity to continue using your account."
          : "Your periodic identity verification is due. Please complete verification to maintain full account access.",
      data: { reason, nextVerificationDate: nextDate.toISOString() },
    },
  });

  return {
    scheduled: true,
    nextVerificationDate: nextDate,
  };
}
