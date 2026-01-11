import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email Service
 * Supports both SMTP (e.g., Gmail, SendGrid) and Firebase Admin (for Firebase projects)
 */
export class EmailService {
  private transporter: Transporter | null = null;
  private useFirebase: boolean;
  private fromEmail: string;
  private fromName: string;

  constructor(useFirebase: boolean = false) {
    this.useFirebase = useFirebase;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@coparent.app';
    this.fromName = process.env.EMAIL_FROM_NAME || 'CoParent';

    if (!useFirebase) {
      this.initializeSMTP();
    }
  }

  /**
   * Initialize SMTP transporter (Nodemailer)
   */
  private initializeSMTP() {
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      console.warn('[EmailService] SMTP not configured. Email sending will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport(smtpConfig);
    console.log('[EmailService] SMTP transporter initialized');
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (this.useFirebase) {
      return this.sendEmailFirebase(options);
    }

    if (!this.transporter) {
      console.warn('[EmailService] Cannot send email: transporter not configured');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`[EmailService] Email sent to ${options.to}`);
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<boolean> {
    const template = this.getWelcomeTemplate(userName);
    return this.sendEmail({ to, ...template });
  }

  /**
   * Send family invitation email
   */
  async sendFamilyInviteEmail(
    to: string,
    inviterName: string,
    familyName?: string
  ): Promise<boolean> {
    const template = this.getFamilyInviteTemplate(inviterName, familyName);
    return this.sendEmail({ to, ...template });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
    const template = this.getPasswordResetTemplate(resetLink);
    return this.sendEmail({ to, ...template });
  }

  /**
   * Send expense notification email
   */
  async sendExpenseNotificationEmail(
    to: string,
    expenseTitle: string,
    amount: string,
    actionUrl: string
  ): Promise<boolean> {
    const template = this.getExpenseNotificationTemplate(expenseTitle, amount, actionUrl);
    return this.sendEmail({ to, ...template });
  }

  /**
   * Send swap request notification email
   */
  async sendSwapRequestEmail(
    to: string,
    requesterName: string,
    requestDetails: string,
    actionUrl: string
  ): Promise<boolean> {
    const template = this.getSwapRequestTemplate(requesterName, requestDetails, actionUrl);
    return this.sendEmail({ to, ...template });
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminderEmail(
    to: string,
    amount: string,
    dueDate: string,
    actionUrl: string
  ): Promise<boolean> {
    const template = this.getPaymentReminderTemplate(amount, dueDate, actionUrl);
    return this.sendEmail({ to, ...template });
  }

  // ==================== Email Templates ====================

  private getWelcomeTemplate(userName: string): EmailTemplate {
    return {
      subject: 'Welcome to CoParent!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4A5568;">Welcome to CoParent, ${userName}!</h1>
          <p>We're excited to have you join our co-parenting community.</p>
          <p>CoParent helps you:</p>
          <ul>
            <li>Share custody schedules</li>
            <li>Track expenses and payments</li>
            <li>Manage tasks and documents</li>
            <li>Communicate with your co-parent</li>
          </ul>
          <p>Get started by inviting your co-parent to join your family!</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E2E8F0;">
            <p style="color: #718096; font-size: 12px;">
              Need help? Visit our <a href="https://coparent.app/help">Help Center</a>
            </p>
          </div>
        </div>
      `,
      text: `Welcome to CoParent, ${userName}! We're excited to have you join our co-parenting community.`,
    };
  }

  private getFamilyInviteTemplate(inviterName: string, familyName?: string): EmailTemplate {
    const family = familyName ? `"${familyName}"` : 'their family';
    return {
      subject: `${inviterName} invited you to join CoParent`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4A5568;">You've been invited!</h1>
          <p><strong>${inviterName}</strong> has invited you to join ${family} on CoParent.</p>
          <p>CoParent makes co-parenting easier by helping you:</p>
          <ul>
            <li>Share custody schedules</li>
            <li>Track expenses together</li>
            <li>Manage tasks and documents</li>
            <li>Communicate effectively</li>
          </ul>
          <div style="margin: 30px 0;">
            <a href="https://coparent.app/signup" 
               style="background-color: #4299E1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #718096; font-size: 14px;">
            Sign up with this email address to automatically join the family.
          </p>
        </div>
      `,
      text: `${inviterName} has invited you to join ${family} on CoParent. Visit https://coparent.app/signup to accept.`,
    };
  }

  private getPasswordResetTemplate(resetLink: string): EmailTemplate {
    return {
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4A5568;">Reset Your Password</h1>
          <p>You requested to reset your password for your CoParent account.</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #4299E1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #718096; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `Reset your password: ${resetLink}`,
    };
  }

  private getExpenseNotificationTemplate(
    expenseTitle: string,
    amount: string,
    actionUrl: string
  ): EmailTemplate {
    return {
      subject: `New Expense: ${expenseTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4A5568;">New Expense Added</h1>
          <p>A new expense has been added to your family:</p>
          <div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">${expenseTitle}</h3>
            <p style="font-size: 24px; font-weight: bold; color: #2D3748; margin: 0;">${amount}</p>
          </div>
          <div style="margin: 30px 0;">
            <a href="${actionUrl}" 
               style="background-color: #4299E1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Expense
            </a>
          </div>
        </div>
      `,
      text: `New expense: ${expenseTitle} - ${amount}. View at ${actionUrl}`,
    };
  }

  private getSwapRequestTemplate(
    requesterName: string,
    requestDetails: string,
    actionUrl: string
  ): EmailTemplate {
    return {
      subject: `Custody Swap Request from ${requesterName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4A5568;">Custody Swap Request</h1>
          <p><strong>${requesterName}</strong> has requested a custody swap:</p>
          <div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>${requestDetails}</p>
          </div>
          <div style="margin: 30px 0;">
            <a href="${actionUrl}" 
               style="background-color: #48BB78; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
              Approve
            </a>
            <a href="${actionUrl}" 
               style="background-color: #F56565; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Decline
            </a>
          </div>
        </div>
      `,
      text: `${requesterName} has requested a custody swap: ${requestDetails}. Respond at ${actionUrl}`,
    };
  }

  private getPaymentReminderTemplate(
    amount: string,
    dueDate: string,
    actionUrl: string
  ): EmailTemplate {
    return {
      subject: `Payment Reminder: ${amount} due ${dueDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4A5568;">Payment Reminder</h1>
          <p>This is a friendly reminder about an upcoming payment:</p>
          <div style="background-color: #FFF5F5; padding: 20px; border-radius: 8px; border-left: 4px solid #F56565; margin: 20px 0;">
            <p style="font-size: 24px; font-weight: bold; color: #C53030; margin: 0 0 10px 0;">${amount}</p>
            <p style="margin: 0;">Due: ${dueDate}</p>
          </div>
          <div style="margin: 30px 0;">
            <a href="${actionUrl}" 
               style="background-color: #4299E1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Mark as Paid
            </a>
          </div>
        </div>
      `,
      text: `Payment reminder: ${amount} due ${dueDate}. View at ${actionUrl}`,
    };
  }

  // ==================== Firebase Methods ====================

  private async sendEmailFirebase(options: EmailOptions): Promise<boolean> {
    // TODO: Implement Firebase email sending
    // Option 1: Use Firebase Extensions (Trigger Email)
    // Option 2: Use Firebase Admin SDK with a mail service
    // Option 3: Queue emails in Firestore for a Cloud Function to process
    
    console.log('[EmailService] Firebase email mode not fully implemented yet');
    console.log('[EmailService] Would send email:', options);
    return false;
  }
}

// Export singleton instances
export const emailService = new EmailService(false); // SMTP
export const emailServiceFirebase = new EmailService(true); // Firebase

export default emailService;
