import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, JWTPayload } from '../types';
import { AppError } from './errorHandler';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header (case-insensitive)
    const authHeader = req.headers.authorization || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7);
    }

    // Check for token in cookies if not in header
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // Check for token in query params (for SSE connections)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      throw new AppError(401, 'Authentication required');
    }

    const payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
    
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError(401, 'Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Invalid token'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions'));
    }

    next();
  };
};

// Optional authentication - doesn't throw error if no token
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;
      req.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
      };
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
  }

  next();
};

// Stricter RBAC aliases for clarity
export const requireAuth = authenticate;

export type Role = 'customer' | 'driver' | 'admin';

export const requireRole = (role: Role) => {
  return authorize(role);
};

// Order ownership check - only customer owner, assigned driver, or admin
export const requireOrderAccess = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new AppError(401, 'Authentication required'));
      }

      const orderId = req.params.id;
      if (!orderId) {
        return next(new AppError(400, 'Order ID required'));
      }

      // Import query function
      const { query } = await import('../db/pool');
      
      // Fetch order
      const orderResult = await query(
        'SELECT id, user_id, driver_id FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.length === 0) {
        return next(new AppError(404, 'Order not found'));
      }

      const order = orderResult[0];
      const user = req.user;

      // Check access: owner, assigned driver, or admin
      const isOwner = user.role === 'customer' && order.user_id === user.id;
      const isDriver = user.role === 'driver' && order.driver_id === user.id;
      const isAdmin = user.role === 'admin';

      if (!(isOwner || isDriver || isAdmin)) {
        return next(new AppError(403, 'Access denied to this order'));
      }

      // Attach order to request for use in handler
      (req as any).order = order;
      next();
    } catch (error) {
      next(error);
    }
  };
};
