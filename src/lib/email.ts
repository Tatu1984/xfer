// Email notification service
// In production, integrate with SendGrid, AWS SES, Resend, etc.

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

// Email templates
const templates = {
  transactionSent: (data: TransactionEmailData) => ({
    subject: `You sent ${data.currency} ${data.amount}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0070f3; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .amount { font-size: 32px; font-weight: bold; color: #dc2626; }
            .details { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Money Sent</h1>
            </div>
            <div class="content">
              <p>Hi ${data.recipientName},</p>
              <p>You have successfully sent money.</p>
              <p class="amount">-${data.currency} ${data.amount}</p>
              <div class="details">
                <p><strong>Reference:</strong> ${data.referenceId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                ${data.description ? `<p><strong>Note:</strong> ${data.description}</p>` : ""}
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from Xfer. Do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  transactionReceived: (data: TransactionEmailData) => ({
    subject: `You received ${data.currency} ${data.amount}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0070f3; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .amount { font-size: 32px; font-weight: bold; color: #16a34a; }
            .details { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Money Received</h1>
            </div>
            <div class="content">
              <p>Hi ${data.recipientName},</p>
              <p>You have received money!</p>
              <p class="amount">+${data.currency} ${data.amount}</p>
              <div class="details">
                <p><strong>Reference:</strong> ${data.referenceId}</p>
                <p><strong>Date:</strong> ${data.date}</p>
                ${data.description ? `<p><strong>Note:</strong> ${data.description}</p>` : ""}
              </div>
            </div>
            <div class="footer">
              <p>This is an automated message from Xfer. Do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
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
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .details { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
              .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin-top: 16px; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Security Alert</h1>
              </div>
              <div class="content">
                <p>Hi ${data.recipientName},</p>
                <p>${alertMessages[data.alertType]}</p>
                <div class="details">
                  <p><strong>Time:</strong> ${data.timestamp}</p>
                  ${data.ipAddress ? `<p><strong>IP Address:</strong> ${data.ipAddress}</p>` : ""}
                  ${data.device ? `<p><strong>Device:</strong> ${data.device}</p>` : ""}
                  ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ""}
                </div>
                <div class="warning">
                  <p><strong>If this wasn't you:</strong></p>
                  <p>Change your password immediately and contact our support team.</p>
                </div>
              </div>
              <div class="footer">
                <p>This is an automated message from Xfer. Do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  },

  kycStatus: (data: KycStatusData) => {
    const statusMessages: Record<string, { title: string; message: string }> = {
      approved: {
        title: "Identity Verified",
        message: "Your identity has been successfully verified. You now have full access to all features.",
      },
      rejected: {
        title: "Verification Failed",
        message: `Your identity verification was not approved. ${data.reason || "Please try again with valid documents."}`,
      },
      pending: {
        title: "Verification In Progress",
        message: "We're reviewing your documents. This usually takes 24-48 hours.",
      },
    };

    const status = statusMessages[data.status];

    return {
      subject: `KYC Update: ${status.title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${data.status === "approved" ? "#16a34a" : data.status === "rejected" ? "#dc2626" : "#f59e0b"}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${status.title}</h1>
              </div>
              <div class="content">
                <p>Hi ${data.recipientName},</p>
                <p>${status.message}</p>
              </div>
              <div class="footer">
                <p>This is an automated message from Xfer. Do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    };
  },

  passwordReset: (name: string, resetLink: string) => ({
    subject: "Reset Your Password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0070f3; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>You requested to reset your password. Click the button below to continue:</p>
              <a href="${resetLink}" class="button">Reset Password</a>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Xfer. Do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  welcomeEmail: (name: string) => ({
    subject: "Welcome to Xfer!",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0070f3; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .features { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Xfer!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Welcome to Xfer! We're excited to have you on board.</p>
              <div class="features">
                <h3>Get started with:</h3>
                <ul>
                  <li>Send money instantly to anyone</li>
                  <li>Request payments easily</li>
                  <li>Manage multiple currencies</li>
                  <li>Track all your transactions</li>
                </ul>
              </div>
              <p>Complete your identity verification to unlock all features!</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Xfer. Do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),
};

// Email sending function
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // In production, implement actual email sending
  // For now, log to console
  console.log("📧 Email would be sent:", {
    to: options.to,
    subject: options.subject,
  });

  // Uncomment and configure for production:
  // Example with Resend:
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'Xfer <noreply@xfer.com>',
  //   to: options.to,
  //   subject: options.subject,
  //   html: options.html,
  // });

  return true;
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
