import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { authService } from '../services/auth';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { queryOne } from '../db/pool';

const router = Router();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().min(10).max(20).required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// Helper to set auth cookies
const setAuthCookies = (res: Response, tokens: { accessToken: string; refreshToken: string }, isMobile: boolean) => {
  if (!isMobile) {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite: 'lax' | 'none' = isProd ? 'none' : 'lax';
    const secure = isProd ? true : false;

    // Web client - use httpOnly cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      path: '/',
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }
};

// POST /api/auth/register
router.post('/register', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('📝 Registration attempt:', { email: req.body.email, name: req.body.name });
    
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      console.error('❌ Validation error:', error.details);
      throw error;
    }

    const { email, password, name, phone } = value;

    // Check if user exists
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      console.log('⚠️  User already exists:', email);
      throw new AppError(400, 'User already exists');
    }

    // Create user
    console.log('✅ Creating new user:', { email, name, phone });
    const user = await authService.createUser(email, password, name, phone);
    const tokens = authService.generateTokenPair(user);

    // Check if mobile client
    const isMobile = req.query.mobile === '1';
    setAuthCookies(res, tokens, isMobile);

    console.log('✅ Registration successful:', email);
    res.status(201).json({
      user: authService.sanitizeUser(user),
      tokens, // Always return tokens for frontend
    });
  } catch (error) {
    console.error('💥 Registration error:', error);
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw error;

    const { email, password } = value;

    const user = await authService.validateLogin(email, password);
    const tokens = authService.generateTokenPair(user);

    // Check if mobile client
    const isMobile = req.query.mobile === '1';
    setAuthCookies(res, tokens, isMobile);

    res.json({
      user: authService.sanitizeUser(user),
      tokens, // Always return tokens for frontend
    });
  } catch (error) {
    console.error('💥 Login Error:', error);
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = refreshSchema.validate(req.body);
    if (error) throw error;

    const { refreshToken } = value;

    // Verify refresh token
    const payload = authService.verifyRefreshToken(refreshToken);
    
    // Get user
    const user = await authService.findUserById(payload.id);
    if (!user) {
      throw new AppError(401, 'User not found');
    }

    // Generate new tokens
    const tokens = authService.generateTokenPair(user);

    // Check if mobile client
    const isMobile = req.query.mobile === '1';
    setAuthCookies(res, tokens, isMobile);

    res.json({
      tokens, // Always return tokens for frontend
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError(401, 'Refresh token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Invalid refresh token'));
    } else {
      next(error);
    }
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSite: 'lax' | 'none' = isProd ? 'none' : 'lax';
  const secure = isProd ? true : false;

  res.clearCookie('accessToken', { httpOnly: true, secure, sameSite, path: '/' });
  res.clearCookie('refreshToken', { httpOnly: true, secure, sameSite, path: '/' });

  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Not authenticated');
    }

    const user = await authService.findUserById(req.user.id);
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      user: authService.sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/verify-email
router.get('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      throw new AppError(400, 'Invalid verification token');
    }

    const user = await authService.verifyEmail(token);
    
    if (!user) {
      throw new AppError(400, 'Invalid or expired verification token');
    }

    res.json({
      message: 'Email verified successfully',
      user: authService.sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      throw new AppError(400, 'Email is required');
    }

    const user = await authService.findUserByEmail(email);
    
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    if (user.emailVerified) {
      throw new AppError(400, 'Email is already verified');
    }

    // Generate new token and send email
    const newToken = authService.generateEmailVerificationToken();
    await queryOne(
      'UPDATE users SET email_verification_token = $1 WHERE id = $2',
      [newToken, user.id]
    );

    const updatedUser = { ...user, emailVerificationToken: newToken };
    await authService.sendVerificationEmail(updatedUser);

    res.json({
      message: 'Verification email sent',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
