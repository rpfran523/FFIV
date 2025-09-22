import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { User, JWTPayload } from '../types';
import { queryOne } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.bcrypt.saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn,
    });
  }

  generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
  }

  verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
  }

  verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
  }

  generateTokenPair(user: User) {
    const payload: JWTPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return queryOne<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
  }

  async findUserById(id: string): Promise<User | null> {
    return queryOne<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
  }

  async createUser(
    email: string,
    password: string,
    name: string,
    phone?: string,
    role: string = 'customer'
  ): Promise<User> {
    const hashedPassword = await this.hashPassword(password);
    const emailVerificationToken = this.generateEmailVerificationToken();
    
    const user = await queryOne<User>(
      `INSERT INTO users (email, password, name, phone, role, email_verification_token) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [email, hashedPassword, name, phone, role, emailVerificationToken]
    );

    if (!user) {
      throw new AppError(500, 'Failed to create user');
    }

    // Send verification email (in production, you'd use a real email service)
    await this.sendVerificationEmail(user);

    return user;
  }

  generateEmailVerificationToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async sendVerificationEmail(user: User): Promise<void> {
    // In production, integrate with AWS SES, SendGrid, etc.
    console.log(`📧 Verification email would be sent to ${user.email}`);
    console.log(`📧 Verification link: http://localhost:8080/verify-email?token=${user.emailVerificationToken}`);
    console.log(`📧 Email content: Welcome ${user.name}! Please verify your email to complete registration.`);
    
    // For demo purposes, we'll auto-verify demo accounts and flowerfairies.com emails
    if (user.email.includes('flowerfairies.com') || user.email.includes('example.com')) {
      await queryOne(
        'UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = $1',
        [user.id]
      );
      console.log(`✅ Auto-verified demo account: ${user.email}`);
    }
  }

  async verifyEmail(token: string): Promise<User | null> {
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE email_verification_token = $1',
      [token]
    );

    if (!user) {
      return null;
    }

    await queryOne(
      'UPDATE users SET email_verified = true, email_verification_token = NULL WHERE id = $1',
      [user.id]
    );

    return user;
  }

  async validateLogin(email: string, password: string): Promise<User> {
    const user = await this.findUserByEmail(email);
    
    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    const isValidPassword = await this.comparePassword(password, user.password);
    
    if (!isValidPassword) {
      throw new AppError(401, 'Invalid credentials');
    }

    return user;
  }

  sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}

export const authService = new AuthService();
