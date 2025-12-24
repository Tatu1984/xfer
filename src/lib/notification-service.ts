import { prisma } from "@/lib/prisma";

// Notification service with email and SMS templates

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SMSTemplate {
  message: string;
}

export interface NotificationPayload {
  userId: string;
  type: "email" | "sms" | "push" | "in_app";
  template: string;
  data: Record<string, unknown>;
  priority?: "low" | "normal" | "high" | "urgent";
}

// Email templates
const EMAIL_TEMPLATES: Record<string, (data: Record<string, unknown>) => EmailTemplate> = {
  welcome: (data) => ({
    subject: "Welcome to Xfer - Your account is ready!",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #0070f3; color: white; padding: 20px; text-align: center; } .content { padding: 20px; background: #f9f9f9; } .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Welcome to Xfer</h1></div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            <p>Thank you for joining Xfer! Your account has been created successfully.</p>
            <p>With Xfer, you can:</p>
            <ul>
              <li>Send and receive money instantly</li>
              <li>Accept payments for your business</li>
              <li>Manage multiple currencies</li>
              <li>Track all your transactions</li>
            </ul>
            <p><a href="${data.dashboardUrl}" class="button">Go to Dashboard</a></p>
            <p>If you have any questions, our support team is here to help.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
            <p>This email was sent to ${data.email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to Xfer, ${data.firstName}!\n\nThank you for joining Xfer! Your account has been created successfully.\n\nVisit your dashboard: ${data.dashboardUrl}\n\n© ${new Date().getFullYear()} Xfer`,
  }),

  payment_received: (data) => ({
    subject: `You received $${data.amount} from ${data.senderName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #22c55e; color: white; padding: 20px; text-align: center; } .amount { font-size: 36px; font-weight: bold; color: #22c55e; text-align: center; padding: 20px; } .details { background: #f9f9f9; padding: 15px; border-radius: 8px; } .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Payment Received</h1></div>
          <div class="amount">+$${data.amount} ${data.currency}</div>
          <div class="details">
            <p><strong>From:</strong> ${data.senderName}</p>
            <p><strong>Reference:</strong> ${data.referenceId}</p>
            <p><strong>Date:</strong> ${new Date(data.date as string).toLocaleDateString()}</p>
            ${data.note ? `<p><strong>Note:</strong> ${data.note}</p>` : ""}
          </div>
          <p style="text-align: center; margin-top: 20px;">
            <a href="${data.transactionUrl}" class="button">View Transaction</a>
          </p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `You received $${data.amount} ${data.currency} from ${data.senderName}\n\nReference: ${data.referenceId}\nDate: ${new Date(data.date as string).toLocaleDateString()}\n${data.note ? `Note: ${data.note}\n` : ""}\nView transaction: ${data.transactionUrl}`,
  }),

  payment_sent: (data) => ({
    subject: `You sent $${data.amount} to ${data.recipientName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #0070f3; color: white; padding: 20px; text-align: center; } .amount { font-size: 36px; font-weight: bold; color: #ef4444; text-align: center; padding: 20px; } .details { background: #f9f9f9; padding: 15px; border-radius: 8px; } .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Payment Sent</h1></div>
          <div class="amount">-$${data.amount} ${data.currency}</div>
          <div class="details">
            <p><strong>To:</strong> ${data.recipientName}</p>
            <p><strong>Reference:</strong> ${data.referenceId}</p>
            <p><strong>Date:</strong> ${new Date(data.date as string).toLocaleDateString()}</p>
            <p><strong>Fee:</strong> $${data.fee || "0.00"}</p>
            ${data.note ? `<p><strong>Note:</strong> ${data.note}</p>` : ""}
          </div>
          <p style="text-align: center; margin-top: 20px;">
            <a href="${data.transactionUrl}" class="button">View Transaction</a>
          </p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `You sent $${data.amount} ${data.currency} to ${data.recipientName}\n\nReference: ${data.referenceId}\nDate: ${new Date(data.date as string).toLocaleDateString()}\nFee: $${data.fee || "0.00"}\n${data.note ? `Note: ${data.note}\n` : ""}\nView transaction: ${data.transactionUrl}`,
  }),

  password_reset: (data) => ({
    subject: "Reset your Xfer password",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #0070f3; color: white; padding: 20px; text-align: center; } .content { padding: 20px; } .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; } .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Password Reset</h1></div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${data.resetUrl}" class="button">Reset Password</a>
            </p>
            <p>This link will expire in ${data.expiresIn || "1 hour"}.</p>
            <div class="warning">
              <strong>Didn't request this?</strong><br>
              If you didn't request a password reset, please ignore this email or contact support if you have concerns.
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Password Reset Request\n\nHi ${data.firstName},\n\nWe received a request to reset your password. Visit this link to create a new password:\n${data.resetUrl}\n\nThis link will expire in ${data.expiresIn || "1 hour"}.\n\nIf you didn't request this, please ignore this email.`,
  }),

  two_factor_code: (data) => ({
    subject: "Your Xfer verification code",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #0070f3; color: white; padding: 20px; text-align: center; } .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 30px; background: #f0f9ff; margin: 20px 0; border-radius: 8px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Verification Code</h1></div>
          <p style="text-align: center;">Use this code to verify your identity:</p>
          <div class="code">${data.code}</div>
          <p style="text-align: center;">This code expires in ${data.expiresIn || "10 minutes"}.</p>
          <p style="text-align: center; color: #666;">If you didn't request this code, please secure your account immediately.</p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Your Xfer verification code is: ${data.code}\n\nThis code expires in ${data.expiresIn || "10 minutes"}.\n\nIf you didn't request this code, please secure your account immediately.`,
  }),

  dispute_opened: (data) => ({
    subject: `Dispute opened for transaction ${data.transactionId}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #ef4444; color: white; padding: 20px; text-align: center; } .content { padding: 20px; } .details { background: #f9f9f9; padding: 15px; border-radius: 8px; } .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Dispute Opened</h1></div>
          <div class="content">
            <p>A dispute has been opened for the following transaction:</p>
            <div class="details">
              <p><strong>Transaction ID:</strong> ${data.transactionId}</p>
              <p><strong>Amount:</strong> $${data.amount} ${data.currency}</p>
              <p><strong>Reason:</strong> ${data.reason}</p>
              <p><strong>Respond by:</strong> ${new Date(data.respondBy as string).toLocaleDateString()}</p>
            </div>
            <p>Please respond to this dispute within the deadline to avoid automatic resolution in the buyer's favor.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${data.disputeUrl}" class="button">Respond to Dispute</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Dispute Opened\n\nA dispute has been opened for transaction ${data.transactionId}.\n\nAmount: $${data.amount} ${data.currency}\nReason: ${data.reason}\nRespond by: ${new Date(data.respondBy as string).toLocaleDateString()}\n\nRespond here: ${data.disputeUrl}`,
  }),

  payout_completed: (data) => ({
    subject: `Your payout of $${data.amount} is complete`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #22c55e; color: white; padding: 20px; text-align: center; } .amount { font-size: 36px; font-weight: bold; color: #22c55e; text-align: center; padding: 20px; } .details { background: #f9f9f9; padding: 15px; border-radius: 8px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Payout Complete</h1></div>
          <div class="amount">$${data.amount} ${data.currency}</div>
          <div class="details">
            <p><strong>Sent to:</strong> ${data.bankName} ****${data.last4}</p>
            <p><strong>Reference:</strong> ${data.referenceId}</p>
            <p><strong>Date:</strong> ${new Date(data.date as string).toLocaleDateString()}</p>
          </div>
          <p style="text-align: center; color: #666; margin-top: 20px;">Funds should arrive in your bank account within 1-3 business days.</p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Payout Complete\n\n$${data.amount} ${data.currency} has been sent to ${data.bankName} ****${data.last4}.\n\nReference: ${data.referenceId}\nDate: ${new Date(data.date as string).toLocaleDateString()}\n\nFunds should arrive within 1-3 business days.`,
  }),

  kyc_approved: (data) => ({
    subject: "Your identity verification is complete",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #22c55e; color: white; padding: 20px; text-align: center; } .content { padding: 20px; text-align: center; } .checkmark { font-size: 64px; color: #22c55e; } .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Verification Complete</h1></div>
          <div class="content">
            <div class="checkmark">✓</div>
            <h2>Your identity has been verified!</h2>
            <p>You now have access to:</p>
            <ul style="text-align: left; display: inline-block;">
              <li>Higher transaction limits</li>
              <li>Bank withdrawals</li>
              <li>Business features</li>
            </ul>
            <p><a href="${data.dashboardUrl}" class="button">Go to Dashboard</a></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Identity Verification Complete\n\nYour identity has been verified! You now have access to higher limits, bank withdrawals, and business features.\n\nVisit your dashboard: ${data.dashboardUrl}`,
  }),

  suspicious_activity: (data) => ({
    subject: "Unusual activity detected on your Xfer account",
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #ef4444; color: white; padding: 20px; text-align: center; } .content { padding: 20px; } .warning { background: #fef3c7; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; } .button { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Security Alert</h1></div>
          <div class="content">
            <div class="warning">
              <strong>Unusual activity detected</strong><br>
              We noticed suspicious activity on your account from ${data.location || "an unknown location"}.
            </div>
            <p><strong>Activity:</strong> ${data.activity}</p>
            <p><strong>Time:</strong> ${new Date(data.timestamp as string).toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${data.ipAddress}</p>
            <p>If this was you, no action is needed. If not, please secure your account immediately:</p>
            <p style="text-align: center;">
              <a href="${data.securityUrl}" class="button">Secure My Account</a>
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Security Alert\n\nUnusual activity detected on your account.\n\nActivity: ${data.activity}\nTime: ${new Date(data.timestamp as string).toLocaleString()}\nLocation: ${data.location || "Unknown"}\nIP: ${data.ipAddress}\n\nIf this wasn't you, secure your account: ${data.securityUrl}`,
  }),

  invoice_created: (data) => ({
    subject: `Invoice #${data.invoiceNumber} from ${data.businessName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: #0070f3; color: white; padding: 20px; text-align: center; } .invoice-box { border: 1px solid #ddd; padding: 20px; margin: 20px 0; border-radius: 8px; } .amount { font-size: 28px; font-weight: bold; color: #0070f3; } .button { display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; } .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }</style></head>
      <body>
        <div class="container">
          <div class="header"><h1>Invoice</h1></div>
          <div class="invoice-box">
            <p><strong>From:</strong> ${data.businessName}</p>
            <p><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
            <p><strong>Due Date:</strong> ${new Date(data.dueDate as string).toLocaleDateString()}</p>
            <hr>
            <p class="amount">Amount Due: $${data.amount} ${data.currency}</p>
          </div>
          <p style="text-align: center;">
            <a href="${data.paymentUrl}" class="button">Pay Now</a>
          </p>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Invoice #${data.invoiceNumber} from ${data.businessName}\n\nAmount Due: $${data.amount} ${data.currency}\nDue Date: ${new Date(data.dueDate as string).toLocaleDateString()}\n\nPay now: ${data.paymentUrl}`,
  }),
};

// SMS templates
const SMS_TEMPLATES: Record<string, (data: Record<string, unknown>) => SMSTemplate> = {
  two_factor_code: (data) => ({
    message: `Your Xfer verification code is: ${data.code}. Expires in ${data.expiresIn || "10 minutes"}. Never share this code.`,
  }),

  payment_received: (data) => ({
    message: `Xfer: You received $${data.amount} from ${data.senderName}. Ref: ${data.referenceId}`,
  }),

  payment_sent: (data) => ({
    message: `Xfer: You sent $${data.amount} to ${data.recipientName}. Ref: ${data.referenceId}`,
  }),

  login_alert: (data) => ({
    message: `Xfer: New login detected from ${data.location || "unknown location"}. If this wasn't you, secure your account immediately.`,
  }),

  suspicious_activity: (data) => ({
    message: `Xfer Security Alert: Unusual activity detected. ${data.activity}. Visit your security settings if this wasn't you.`,
  }),

  payout_initiated: (data) => ({
    message: `Xfer: Payout of $${data.amount} initiated to your bank account ****${data.last4}. Arrives in 1-3 business days.`,
  }),

  password_changed: (data) => ({
    message: `Xfer: Your password was changed. If this wasn't you, contact support immediately.`,
  }),

  limit_warning: (data) => ({
    message: `Xfer: You've used ${data.percentage}% of your ${data.limitType} limit. Complete verification to increase limits.`,
  }),
};

// Send email notification
export async function sendEmail(
  to: string,
  template: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const templateFn = EMAIL_TEMPLATES[template];
    if (!templateFn) {
      return { success: false, error: `Unknown email template: ${template}` };
    }

    const emailContent = templateFn(data);

    // In production, integrate with SendGrid, AWS SES, or similar
    // For simulation, just log and return success
    console.log(`[Email] To: ${to}, Subject: ${emailContent.subject}`);

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 99% success rate
    if (Math.random() > 0.01) {
      return {
        success: true,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      };
    }

    return { success: false, error: "Email delivery failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Send SMS notification
export async function sendSMS(
  phone: string,
  template: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const templateFn = SMS_TEMPLATES[template];
    if (!templateFn) {
      return { success: false, error: `Unknown SMS template: ${template}` };
    }

    const smsContent = templateFn(data);

    // Validate phone number format
    if (!/^\+?[\d\s-()]{10,}$/.test(phone)) {
      return { success: false, error: "Invalid phone number format" };
    }

    // In production, integrate with Twilio, AWS SNS, or similar
    console.log(`[SMS] To: ${phone}, Message: ${smsContent.message}`);

    // Simulate SMS sending delay
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 98% success rate
    if (Math.random() > 0.02) {
      return {
        success: true,
        messageId: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      };
    }

    return { success: false, error: "SMS delivery failed" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Send push notification
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's trusted devices
    const devices = await prisma.device.findMany({
      where: {
        userId,
        isTrusted: true,
      },
      select: { id: true, deviceType: true },
    });

    if (devices.length === 0) {
      return { success: false, error: "No registered devices" };
    }

    // In production, integrate with Firebase Cloud Messaging, APNs, etc.
    // Push tokens would be stored in the device record or a separate table
    console.log(`[Push] User: ${userId}, Title: ${title}, Body: ${body}, Devices: ${devices.length}`);
    if (data) {
      console.log(`[Push] Data:`, data);
    }

    // Simulate push sending
    await new Promise((resolve) => setTimeout(resolve, 100));

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Create in-app notification
export async function createInAppNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data as object | undefined,
      },
    });

    return { success: true, notificationId: notification.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Send notification via all enabled channels
export async function sendNotification(
  payload: NotificationPayload
): Promise<{
  success: boolean;
  results: Record<string, { success: boolean; error?: string }>;
}> {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      email: true,
      phone: true,
      emailVerified: true,
      phoneVerified: true,
    },
  });

  if (!user) {
    return { success: false, results: { error: { success: false, error: "User not found" } } };
  }

  const results: Record<string, { success: boolean; error?: string }> = {};

  // Email
  if (user.email && user.emailVerified && EMAIL_TEMPLATES[payload.template]) {
    results.email = await sendEmail(user.email, payload.template, payload.data);
  }

  // SMS (only for high priority or urgent)
  if (
    user.phone &&
    user.phoneVerified &&
    SMS_TEMPLATES[payload.template] &&
    (payload.priority === "high" || payload.priority === "urgent")
  ) {
    results.sms = await sendSMS(user.phone, payload.template, payload.data);
  }

  // In-app notification
  const title = payload.data.title as string || payload.template.replace(/_/g, " ");
  const message = payload.data.message as string || "";
  results.inApp = await createInAppNotification(
    payload.userId,
    payload.template,
    title,
    message,
    payload.data
  );

  // Push notification (for high/urgent priority)
  if (payload.priority === "high" || payload.priority === "urgent") {
    results.push = await sendPushNotification(payload.userId, title, message, payload.data);
  }

  const overallSuccess = Object.values(results).some((r) => r.success);

  return { success: overallSuccess, results };
}

// Get available templates
export function getAvailableTemplates(): {
  email: string[];
  sms: string[];
} {
  return {
    email: Object.keys(EMAIL_TEMPLATES),
    sms: Object.keys(SMS_TEMPLATES),
  };
}

// Queue notification for batch processing
export async function queueNotification(
  payload: NotificationPayload
): Promise<string> {
  // In production, use a proper queue like Bull, SQS, etc.
  // For now, just send immediately
  setImmediate(() => sendNotification(payload));

  return `notification_${Date.now()}`;
}

// Bulk send notifications
export async function sendBulkNotifications(
  userIds: string[],
  template: string,
  getData: (userId: string) => Record<string, unknown> | Promise<Record<string, unknown>>
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      const data = await getData(userId);
      const result = await sendNotification({
        userId,
        type: "email",
        template,
        data,
        priority: "normal",
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}
