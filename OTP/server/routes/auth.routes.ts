import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, verificationTokens } from '../shared/production-schema';
import { getEmailService } from '../services/email.service';
import { logActivity } from '../middleware/activityLogger';
import { authenticateToken } from '../middleware/auth';
import { logError } from '../middleware/requestLogger';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().optional(),
  company: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const verifyEmailSchema = z.object({
  token: z.string().min(1)
});

const resendVerificationSchema = z.object({
  email: z.string().email()
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        error: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // Hash password securely with bcrypt
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(validatedData.password, saltRounds);

    // Create user with hashed password
    const [newUser] = await db
      .insert(users)
      .values({
        email: validatedData.email,
        password: passwordHash,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone || null,
        company: validatedData.company || null,
        role: 'user',
        isEmailVerified: false,
        isActive: true
      })
      .returning();

    // Create verification token
    const emailService = getEmailService();
    const verificationToken = await emailService.createVerificationToken(
      newUser.id,
      'email_verification'
    );

    // Send verification email
    await emailService.sendVerificationEmail(
      newUser.email,
      newUser.firstName,
      verificationToken
    );

    // Log activity
    await logActivity({
      userId: newUser.id,
      action: 'user_registered',
      resourceType: 'users',
      resourceId: newUser.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: { email: newUser.email }
    });

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        isEmailVerified: newUser.isEmailVerified
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logError(error as Error, { 
      context: 'auth-routes', 
      route: 'register',
      severity: 'error',
      metadata: { email: req.body.email }
    });
    res.status(500).json({ 
      error: 'Registration failed',
      code: 'REGISTRATION_FAILED'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);

    if (!isValidPassword) {
      // Log failed login attempt
      await logActivity({
        userId: user.id,
        action: 'login_failed',
        resourceType: 'users',
        resourceId: user.id,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        metadata: { reason: 'invalid_password' }
      });

      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '24h' }
    );

    // Log successful login
    await logActivity({
      userId: user.id,
      action: 'login_success',
      resourceType: 'users',
      resourceId: user.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: { ip: req.ip }
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        company: user.company
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logError(error as Error, { 
      context: 'auth-routes', 
      route: 'login',
      severity: 'error',
      metadata: { email: req.body.email }
    });
    res.status(500).json({ 
      error: 'Login failed',
      code: 'LOGIN_FAILED'
    });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    
    const emailService = getEmailService();
    const userId = await emailService.verifyToken(token, 'email_verification');

    if (!userId) {
      return res.status(400).json({ 
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    // Update user as verified
    const [updatedUser] = await db
      .update(users)
      .set({ 
        isEmailVerified: true,
        emailVerifiedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Log activity
    await logActivity({
      userId: updatedUser.id,
      action: 'email_verified',
      resourceType: 'users',
      resourceId: updatedUser.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: { email: updatedUser.email }
    });

    res.json({
      message: 'Email verified successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        isEmailVerified: updatedUser.isEmailVerified
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logError(error as Error, { 
      context: 'auth-routes', 
      route: 'verify-email',
      severity: 'error',
      metadata: { token: req.body.token }
    });
    res.status(500).json({ 
      error: 'Email verification failed',
      code: 'VERIFICATION_FAILED'
    });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);
    
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ 
        error: 'Email already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    // Create new verification token
    const emailService = getEmailService();
    const verificationToken = await emailService.createVerificationToken(
      user.id,
      'email_verification'
    );

    // Send verification email
    await emailService.sendVerificationEmail(
      user.email,
      user.firstName,
      verificationToken
    );

    // Log activity
    await logActivity({
      userId: user.id,
      action: 'verification_email_resent',
      resourceType: 'users',
      resourceId: user.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: { email: user.email }
    });

    res.json({
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logError(error as Error, { 
      context: 'auth-routes', 
      route: 'resend-verification',
      severity: 'error',
      metadata: { email: req.body.email }
    });
    res.status(500).json({ 
      error: 'Failed to resend verification email',
      code: 'RESEND_FAILED'
    });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal if user exists
      return res.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    if (!user.isActive) {
      return res.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Create password reset token (expires in 1 hour)
    const emailService = getEmailService();
    const resetToken = await emailService.createVerificationToken(
      user.id,
      'password_reset',
      1 // 1 hour expiration
    );

    // Send password reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      resetToken
    );

    // Log activity
    await logActivity({
      userId: user.id,
      action: 'password_reset_requested',
      resourceType: 'users',
      resourceId: user.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: { email: user.email }
    });

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logError(error as Error, { 
      context: 'auth-routes', 
      route: 'forgot-password',
      severity: 'error',
      metadata: { email: req.body.email }
    });
    res.status(500).json({ 
      error: 'Failed to process password reset request',
      code: 'RESET_REQUEST_FAILED'
    });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    
    const emailService = getEmailService();
    const userId = await emailService.verifyToken(token, 'password_reset');

    if (!userId) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    // Hash new password securely
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password with hash
    const [updatedUser] = await db
      .update(users)
      .set({ 
        password: passwordHash,
        passwordResetAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Log activity
    await logActivity({
      userId: updatedUser.id,
      action: 'password_reset_completed',
      resourceType: 'users',
      resourceId: updatedUser.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: { email: updatedUser.email }
    });

    res.json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logError(error as Error, { 
      context: 'auth-routes', 
      route: 'reset-password',
      severity: 'error',
      metadata: { token: req.body.token }
    });
    res.status(500).json({ 
      error: 'Failed to reset password',
      code: 'RESET_FAILED'
    });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    
    const updateSchema = z.object({
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      phone: z.string().optional(),
      company: z.string().optional()
    });

    const validatedData = updateSchema.parse(req.body);
    
    const [updatedUser] = await db
      .update(users)
      .set(validatedData)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Log activity
    await logActivity({
      userId: updatedUser.id,
      action: 'profile_updated',
      resourceType: 'users',
      resourceId: updatedUser.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      metadata: validatedData
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isEmailVerified: updatedUser.isEmailVerified,
        company: updatedUser.company,
        phone: updatedUser.phone
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    logError(error as Error, { 
      context: 'auth-routes', 
      route: 'update-profile',
      severity: 'error',
      metadata: { userId: (req as any).user?.userId }
    });
    res.status(500).json({ 
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED'
    });
  }
});

export default router;