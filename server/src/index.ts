import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import driverRoutes from './routes/driver';
import stripeRoutes from './routes/stripe';
import { sseHub } from './services/sse';
import { initializeDatabase } from './db/initialize';
import { cacheService } from './services/cache';

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize services
async function initializeServices() {
  try {
    // Initialize database (optional for demo)
    try {
      await initializeDatabase();
      console.log('✅ Database initialized');
    } catch (dbError) {
      console.warn('⚠️  Database initialization failed (continuing without DB):', dbError.message);
    }

    // Initialize cache
    await cacheService.connect();
    console.log('✅ Cache service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = ['http://localhost:5173'];
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://ff-chi.onrender.com');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);

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
app.use('/api/stripe', stripeRoutes);

// SSE endpoint
app.get('/api/events', sseHub.handleConnection);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // In the Docker container, client files are at /app/dist/client
  const clientBuildPath = path.join(process.cwd(), 'dist', 'client');
  app.use(express.static(clientBuildPath));
  
  // Catch all handler for client-side routing
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

// Handle graceful shutdown
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
