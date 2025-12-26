import { Resend } from "resend";

// Initialize Resend client - will be null if no API key configured
const resend = process.env.RESEND_API_KEY?.startsWith("re_")
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "Xfer <noreply@xfer.com>";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface TransactionEmailData {
  recipientName: string;
  amount: string;
  currency: string;
  type: "sent" | "received";
  referenceId: string;
  date: string;
  description?: string;
}

export interface SecurityAlertData {
  recipientName: string;
  alertType: "login" | "password_change" | "mfa_enabled" | "mfa_disabled" | "new_device";
  ipAddress?: string;
  device?: string;
  location?: string;
  timestamp: string;
}

export interface KycStatusData {
  recipientName: string;
  status: "approved" | "rejected" | "pending";
  reason?: string;
}

// Base email template wrapper
function wrapInTemplate(content: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #0070f3 0%, #0050d0 100%);
            color: white;
            padding: 32px 24px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 32px 24px;
          }
          .amount {
            font-size: 36px;
            font-weight: 700;
            margin: 16px 0;
          }
          .amount.sent { color: #dc2626; }
          .amount.received { color: #16a34a; }
          .details {
            background: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
          }
          .details p {
            margin: 8px 0;
            font-size: 14px;
          }
          .details strong {
            color: #6b7280;
          }
          .button {
            display: inline-block;
            background: #0070f3;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 16px 0;
          }
          .warning {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-left: 4px solid #dc2626;
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
          }
          .success {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-left: 4px solid #16a34a;
            padding: 16px;
            border-radius: 8px;
            margin: 16px 0;
          }
          .footer {
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
            padding: 24px;
            border-top: 1px solid #e5e7eb;
          }
          .footer a {
            color: #6b7280;
          }
          .logo {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -1px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            ${content}
          </div>
          <div class="footer">
            <p>This is an automated message from Xfer. Please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Xfer. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Email templates
const templates = {
  transactionSent: (data: TransactionEmailData) => ({
    subject: `You sent ${data.currency} ${data.amount}`,
    html: wrapInTemplate(`
      <div class="header">
        <div class="logo">Xfer</div>
        <h1>Money Sent</h1>
      </div>
      <div class="content">
        <p>Hi ${data.recipientName},</p>
        <p>Your transfer has been completed successfully.</p>
        <p class="amount sent">-${data.currency} ${data.amount}</p>
        <div class="details">
          <p><strong>Reference:</strong> ${data.referenceId}</p>
          <p><strong>Date:</strong> ${data.date}</p>
          ${data.description ? `<p><strong>Note:</strong> ${data.description}</p>` : ""}
        </div>
        <p>Need help? Visit our <a href="${process.env.NEXT_PUBLIC_APP_URL}/support">support center</a>.</p>
      </div>
    `, "Money Sent"),
  }),

  transactionReceived: (data: TransactionEmailData) => ({
    subject: `You received ${data.currency} ${data.amount}`,
    html: wrapInTemplate(`
      <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
        <div class="logo">Xfer</div>
        <h1>Money Received</h1>
      </div>
      <div class="content">
        <p>Hi ${data.recipientName},</p>
        <p>Great news! You've received money.</p>
        <p class="amount received">+${data.currency} ${data.amount}</p>
        <div class="details">
          <p><strong>Reference:</strong> ${data.referenceId}</p>
          <p><strong>Date:</strong> ${data.date}</p>
          ${data.description ? `<p><strong>Note:</strong> ${data.description}</p>` : ""}
        </div>
        <div class="success">
          <p><strong>The funds are now available in your wallet.</strong></p>
        </div>
      </div>
    `, "Money Received"),
  }),

  securityAlert: (data: SecurityAlertData) => {
    const alertMessages: Record<string, string> = {
      login: "New login detected on your account",
      password_change: "Your password was changed",
      mfa_enabled: "Two-factor authentication was enabled",
      mfa_disabled: "Two-factor authentication was disabled",
      new_device: "New device added to your account",
    };

    return {
      subject: `Security Alert: ${alertMessages[data.alertType]}`,
      html: wrapInTemplate(`
        <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
          <div class="logo">Xfer</div>
          <h1>Security Alert</h1>
        </div>
        <div class="content">
          <p>Hi ${data.recipientName},</p>
          <p><strong>${alertMessages[data.alertType]}</strong></p>
          <div class="details">
            <p><strong>Time:</strong> ${data.timestamp}</p>
            ${data.ipAddress ? `<p><strong>IP Address:</strong> ${data.ipAddress}</p>` : ""}
            ${data.device ? `<p><strong>Device:</strong> ${data.device}</p>` : ""}
            ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ""}
          </div>
          <div class="warning">
            <p><strong>Wasn't you?</strong></p>
            <p>If you didn't make this change, please secure your account immediately by changing your password and enabling two-factor authentication.</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/security" class="button">Review Security Settings</a>
        </div>
      `, "Security Alert"),
    };
  },

  kycStatus: (data: KycStatusData) => {
    const statusConfig = {
      approved: {
        title: "Identity Verified",
        message: "Your identity has been successfully verified. You now have full access to all features.",
        headerColor: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
        icon: "success",
      },
      rejected: {
        title: "Verification Failed",
        message: `Your identity verification was not approved. ${data.reason || "Please try again with valid documents."}`,
        headerColor: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
        icon: "warning",
      },
      pending: {
        title: "Verification In Progress",
        message: "We're reviewing your documents. This usually takes 24-48 hours.",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        icon: "info",
      },
    };

    const config = statusConfig[data.status];

    return {
      subject: `KYC Update: ${config.title}`,
      html: wrapInTemplate(`
        <div class="header" style="background: ${config.headerColor};">
          <div class="logo">Xfer</div>
          <h1>${config.title}</h1>
        </div>
        <div class="content">
          <p>Hi ${data.recipientName},</p>
          <div class="${config.icon}">
            <p>${config.message}</p>
          </div>
          ${data.status === "rejected" ? `
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/kyc" class="button">Retry Verification</a>
          ` : ""}
          ${data.status === "approved" ? `
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">Go to Dashboard</a>
          ` : ""}
        </div>
      `, config.title),
    };
  },

  passwordReset: (name: string, resetLink: string) => ({
    subject: "Reset Your Password",
    html: wrapInTemplate(`
      <div class="header">
        <div class="logo">Xfer</div>
        <h1>Password Reset</h1>
      </div>
      <div class="content">
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <a href="${resetLink}" class="button">Reset Password</a>
        <div class="details">
          <p><strong>This link expires in 1 hour.</strong></p>
          <p>If you didn't request this, you can safely ignore this email. Your password won't be changed.</p>
        </div>
      </div>
    `, "Password Reset"),
  }),

  welcomeEmail: (name: string) => ({
    subject: "Welcome to Xfer!",
    html: wrapInTemplate(`
      <div class="header">
        <div class="logo">Xfer</div>
        <h1>Welcome Aboard!</h1>
      </div>
      <div class="content">
        <p>Hi ${name},</p>
        <p>Thanks for joining Xfer! We're excited to have you.</p>
        <div class="details">
          <p><strong>What you can do:</strong></p>
          <p>&#10003; Send money instantly to anyone</p>
          <p>&#10003; Request payments easily</p>
          <p>&#10003; Manage multiple currencies</p>
          <p>&#10003; Track all your transactions</p>
        </div>
        <div class="success">
          <p><strong>Complete your identity verification to unlock all features and higher limits!</strong></p>
        </div>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/kyc" class="button">Verify Your Identity</a>
      </div>
    `, "Welcome to Xfer"),
  }),

  moneyRequest: (
    recipientName: string,
    requesterName: string,
    amount: string,
    currency: string,
    note?: string,
    requestLink?: string
  ) => ({
    subject: `${requesterName} is requesting ${currency} ${amount}`,
    html: wrapInTemplate(`
      <div class="header">
        <div class="logo">Xfer</div>
        <h1>Money Request</h1>
      </div>
      <div class="content">
        <p>Hi ${recipientName},</p>
        <p><strong>${requesterName}</strong> is requesting payment from you.</p>
        <p class="amount">${currency} ${amount}</p>
        ${note ? `
          <div class="details">
            <p><strong>Note:</strong> ${note}</p>
          </div>
        ` : ""}
        <a href="${requestLink || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`}" class="button">Pay Now</a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">
          You can also decline this request from your dashboard.
        </p>
      </div>
    `, "Money Request"),
  }),

  invoiceSent: (
    recipientName: string,
    businessName: string,
    invoiceNumber: string,
    amount: string,
    currency: string,
    dueDate: string,
    payLink: string
  ) => ({
    subject: `Invoice #${invoiceNumber} from ${businessName}`,
    html: wrapInTemplate(`
      <div class="header">
        <div class="logo">Xfer</div>
        <h1>Invoice</h1>
      </div>
      <div class="content">
        <p>Hi ${recipientName},</p>
        <p>You've received an invoice from <strong>${businessName}</strong>.</p>
        <div class="details">
          <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> ${currency} ${amount}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
        </div>
        <a href="${payLink}" class="button">Pay Invoice</a>
      </div>
    `, `Invoice #${invoiceNumber}`),
  }),

  disputeUpdate: (
    recipientName: string,
    disputeId: string,
    status: string,
    message: string
  ) => ({
    subject: `Dispute Update: ${status}`,
    html: wrapInTemplate(`
      <div class="header">
        <div class="logo">Xfer</div>
        <h1>Dispute Update</h1>
      </div>
      <div class="content">
        <p>Hi ${recipientName},</p>
        <p>There's an update on your dispute.</p>
        <div class="details">
          <p><strong>Dispute ID:</strong> ${disputeId}</p>
          <p><strong>Status:</strong> ${status}</p>
        </div>
        <p>${message}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/disputes/${disputeId}" class="button">View Dispute</a>
      </div>
    `, "Dispute Update"),
  }),
};

// Main email sending function
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (resend) {
      // Production: Use Resend
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        console.error("Failed to send email:", error);
        return false;
      }

      console.log(`Email sent to ${options.to}: ${options.subject}`);
      return true;
    } else {
      // Development: Log to console
      console.log("========================================");
      console.log("EMAIL (Dev Mode - No Resend API Key)");
      console.log("========================================");
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log("----------------------------------------");
      console.log("HTML content would be sent...");
      console.log("========================================");
      return true;
    }
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
}

// Convenience functions
export async function sendTransactionEmail(
  to: string,
  data: TransactionEmailData
): Promise<boolean> {
  const template =
    data.type === "sent"
      ? templates.transactionSent(data)
      : templates.transactionReceived(data);

  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendSecurityAlert(
  to: string,
  data: SecurityAlertData
): Promise<boolean> {
  const template = templates.securityAlert(data);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendKycStatusEmail(
  to: string,
  data: KycStatusData
): Promise<boolean> {
  const template = templates.kycStatus(data);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetLink: string
): Promise<boolean> {
  const template = templates.passwordReset(name, resetLink);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<boolean> {
  const template = templates.welcomeEmail(name);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendMoneyRequestEmail(
  to: string,
  recipientName: string,
  requesterName: string,
  amount: string,
  currency: string,
  note?: string,
  requestLink?: string
): Promise<boolean> {
  const template = templates.moneyRequest(
    recipientName,
    requesterName,
    amount,
    currency,
    note,
    requestLink
  );
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendInvoiceEmail(
  to: string,
  recipientName: string,
  businessName: string,
  invoiceNumber: string,
  amount: string,
  currency: string,
  dueDate: string,
  payLink: string
): Promise<boolean> {
  const template = templates.invoiceSent(
    recipientName,
    businessName,
    invoiceNumber,
    amount,
    currency,
    dueDate,
    payLink
  );
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}

export async function sendDisputeUpdateEmail(
  to: string,
  recipientName: string,
  disputeId: string,
  status: string,
  message: string
): Promise<boolean> {
  const template = templates.disputeUpdate(recipientName, disputeId, status, message);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
}
