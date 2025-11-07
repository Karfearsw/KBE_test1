import nodemailer from 'nodemailer';
import { createTransport, Transporter } from 'nodemailer';
import { render } from '@react-email/render';
import crypto from 'crypto';
import { db } from '../db';
import { verificationTokens, users } from '../../shared/production-schema';
import { eq, and, gt } from 'drizzle-orm';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    email: string;
  };
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface VerificationEmailData {
  firstName: string;
  verificationUrl: string;
  expiresIn: string;
  supportEmail: string;
  companyName: string;
}

export interface PasswordResetEmailData {
  firstName: string;
  resetUrl: string;
  expiresIn: string;
  supportEmail: string;
  companyName: string;
}

export class EmailService {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5
    });
  }

  // Generate secure verification token
  static generateVerificationToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate secure URL-safe token
  static generateUrlSafeToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  // Create verification token in database
  async createVerificationToken(
    userId: string, 
    type: 'email_verification' | 'password_reset' | 'api_key',
    expiresInHours: number = 24
  ): Promise<string> {
    const token = EmailService.generateUrlSafeToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    await db.insert(verificationTokens).values({
      userId,
      token,
      type,
      expiresAt
    });

    return token;
  }

  // Verify token and mark as used
  async verifyToken(token: string, type: 'email_verification' | 'password_reset' | 'api_key'): Promise<string | null> {
    try {
      const [verificationToken] = await db
        .select()
        .from(verificationTokens)
        .where(and(
          eq(verificationTokens.token, token),
          eq(verificationTokens.type, type),
          gt(verificationTokens.expiresAt, new Date()),
          eq(verificationTokens.usedAt, null)
        ))
        .limit(1);

      if (!verificationToken) {
        return null;
      }

      // Mark token as used
      await db
        .update(verificationTokens)
        .set({ usedAt: new Date() })
        .where(eq(verificationTokens.id, verificationToken.id));

      return verificationToken.userId;
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  // Clean up expired tokens
  async cleanupExpiredTokens(): Promise<void> {
    try {
      await db
        .delete(verificationTokens)
        .where(gt(verificationTokens.expiresAt, new Date()));
    } catch (error) {
      console.error('Cleanup expired tokens error:', error);
    }
  }

  // Email verification template
  private createVerificationEmailTemplate(data: VerificationEmailData): EmailTemplate {
    const subject = `Verify your email - ${data.companyName}`;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification - ${data.companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .content h2 { color: #1a202c; font-size: 24px; margin-bottom: 20px; }
        .content p { color: #4a5568; line-height: 1.6; margin-bottom: 20px; }
        .verification-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
        .verification-link { background: #f7fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; word-break: break-all; color: #2d3748; }
        .footer { background: #f7fafc; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
        .security-notice { background: #fff5f5; border: 1px solid #feb2b2; padding: 15px; border-radius: 6px; margin: 20px 0; color: #c53030; }
        .expiry-notice { background: #fffaf0; border: 1px solid #fbd38d; padding: 15px; border-radius: 6px; margin: 20px 0; color: #dd6b20; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data.companyName}</h1>
        </div>
        <div class="content">
            <h2>Welcome, ${data.firstName}!</h2>
            <p>Thank you for signing up with ${data.companyName}. To complete your registration and secure your account, please verify your email address by clicking the button below.</p>
            
            <div style="text-align: center;">
                <a href="${data.verificationUrl}" class="verification-button">Verify Email Address</a>
            </div>
            
            <div class="expiry-notice">
                <strong>Important:</strong> This verification link will expire in ${data.expiresIn}. Please verify your email as soon as possible.
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="verification-link">${data.verificationUrl}</div>
            
            <div class="security-notice">
                <strong>Security Notice:</strong> If you didn't create this account, please ignore this email or contact our support team immediately.
            </div>
            
            <p>Once verified, you'll have full access to all features of our platform.</p>
        </div>
        <div class="footer">
            <p>Need help? Contact us at <a href="mailto:${data.supportEmail}" style="color: #667eea;">${data.supportEmail}</a></p>
            <p>&copy; ${new Date().getFullYear()} ${data.companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;

    const text = `
Welcome to ${data.companyName}, ${data.firstName}!

Thank you for signing up. To complete your registration, please verify your email address by clicking the link below:

${data.verificationUrl}

This verification link will expire in ${data.expiresIn}.

If you didn't create this account, please ignore this email or contact our support team at ${data.supportEmail}.

Best regards,
The ${data.companyName} Team
    `;

    return { subject, html, text };
  }

  // Password reset email template
  private createPasswordResetEmailTemplate(data: PasswordResetEmailData): EmailTemplate {
    const subject = `Password Reset Request - ${data.companyName}`;
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - ${data.companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); padding: 40px 20px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .content h2 { color: #1a202c; font-size: 24px; margin-bottom: 20px; }
        .content p { color: #4a5568; line-height: 1.6; margin-bottom: 20px; }
        .reset-button { display: inline-block; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
        .reset-link { background: #f7fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; word-break: break-all; color: #2d3748; }
        .footer { background: #f7fafc; padding: 30px; text-align: center; color: #718096; font-size: 14px; }
        .security-notice { background: #fff5f5; border: 1px solid #feb2b2; padding: 15px; border-radius: 6px; margin: 20px 0; color: #c53030; }
        .expiry-notice { background: #fffaf0; border: 1px solid #fbd38d; padding: 15px; border-radius: 6px; margin: 20px 0; color: #dd6b20; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset</h1>
        </div>
        <div class="content">
            <h2>Hello, ${data.firstName}!</h2>
            <p>We received a request to reset your password for your ${data.companyName} account. If you made this request, please click the button below to reset your password.</p>
            
            <div style="text-align: center;">
                <a href="${data.resetUrl}" class="reset-button">Reset Password</a>
            </div>
            
            <div class="expiry-notice">
                <strong>Important:</strong> This password reset link will expire in ${data.expiresIn} for security reasons.
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <div class="reset-link">${data.resetUrl}</div>
            
            <div class="security-notice">
                <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your account remains secure, and no changes have been made.
            </div>
            
            <p>For your security, we recommend choosing a strong, unique password that you haven't used elsewhere.</p>
        </div>
        <div class="footer">
            <p>Need help? Contact us at <a href="mailto:${data.supportEmail}" style="color: #e53e3e;">${data.supportEmail}</a></p>
            <p>&copy; ${new Date().getFullYear()} ${data.companyName}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;

    const text = `
Password Reset Request - ${data.companyName}

Hello, ${data.firstName}!

We received a request to reset your password. If you made this request, please click the link below:

${data.resetUrl}

This password reset link will expire in ${data.expiresIn}.

If you didn't request a password reset, please ignore this email. Your account remains secure.

Best regards,
The ${data.companyName} Team
    `;

    return { subject, html, text };
  }

  // Send email verification
  async sendVerificationEmail(
    to: string, 
    firstName: string, 
    verificationToken: string,
    companyName: string = 'OTP Leads',
    supportEmail: string = 'support@otpleads.com'
  ): Promise<void> {
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      const templateData: VerificationEmailData = {
        firstName,
        verificationUrl,
        expiresIn: '24 hours',
        supportEmail,
        companyName
      };

      const template = this.createVerificationEmailTemplate(templateData);

      await this.transporter.sendMail({
        from: `"${this.config.from.name}" <${this.config.from.email}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html
      });

      console.log(`Verification email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(
    to: string, 
    firstName: string, 
    resetToken: string,
    companyName: string = 'OTP Leads',
    supportEmail: string = 'support@otpleads.com'
  ): Promise<void> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      const templateData: PasswordResetEmailData = {
        firstName,
        resetUrl,
        expiresIn: '1 hour',
        supportEmail,
        companyName
      };

      const template = this.createPasswordResetEmailTemplate(templateData);

      await this.transporter.sendMail({
        from: `"${this.config.from.name}" <${this.config.from.email}>`,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html
      });

      console.log(`Password reset email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  // Test email configuration
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }

  // Close transporter
  async close(): Promise<void> {
    await this.transporter.close();
  }
}

// Email service instance
let emailService: EmailService | null = null;

export const getEmailService = (): EmailService => {
  if (!emailService) {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: {
        name: process.env.EMAIL_FROM_NAME || 'OTP Leads',
        email: process.env.EMAIL_FROM_ADDRESS || 'noreply@otpleads.com'
      }
    };

    emailService = new EmailService(config);
  }
  return emailService;
};

export default EmailService;