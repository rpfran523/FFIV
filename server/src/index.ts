import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Add unhandled error logging
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import driverRoutes from './routes/driver';
import stripeRoutes from './routes/stripe';
import searchRoutes from './routes/search';
import { sseHub } from './services/sse';
import { initializeDatabase } from './db/initialize';
import { cacheService } from './services/cache';

const app = express();
const PORT = process.env.PORT || 8080;

// CORS & security
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "font-src": ["'self'", "https:"],
      "img-src": ["'self'", "data:", "https:"],
      "object-src": ["'none'"],
      "script-src": ["'self'", "https:"],
      "style-src": ["'self'", "'unsafe-inline'", "https:"],
      "connect-src": ["'self'", process.env.FRONTEND_URL || 'https://ff-chi.onrender.com', "https:"]
    }
  } : false,
  crossOriginEmbedderPolicy: false,
}));

// Basic API rate limiter
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

const allowedOrigins = ['http://localhost:5173'];
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push(process.env.FRONTEND_URL || 'https://ff-chi.onrender.com');
}
const FRONTEND_URL = process.env.FRONTEND_URL || allowedOrigins[0];
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors({ origin: FRONTEND_URL, credentials: true }));

// Mount Stripe webhook BEFORE json parser to preserve raw body
app.use('/api/stripe', (req, res, next) => next(), stripeRoutes);

// Parsers & logging
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

// Initialize services
async function initializeServices() {
  try {
    try {
      await initializeDatabase();
      console.log('✅ Database initialized');
    } catch (dbError) {
      console.warn('⚠️  Database initialization failed (continuing without DB):', (dbError as any).message);
    }
    await cacheService.connect();
    console.log('✅ Cache service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    services: {
      database: 'connected',
      cache: cacheService.isConnected() ? 'connected' : 'fallback',
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/search', searchRoutes);

// SSE endpoint
app.get('/api/events', sseHub.handleConnection);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(process.cwd(), 'dist', 'client');
  app.use(express.static(clientBuildPath, { maxAge: '7d', etag: true, lastModified: true, cacheControl: true }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Error handling
app.use(errorHandler);

// Start server
async function start() {
  await initializeServices();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  });
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await cacheService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await cacheService.disconnect();
  process.exit(0);
});

start().catch(console.error);
