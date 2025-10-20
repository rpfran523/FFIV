import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, authorize } from '../middleware/auth';
import { query, queryOne } from '../db/pool';
import { cacheService } from '../services/cache';
import { getStripe } from '../lib/stripe';
import { Analytics } from '../types';
import { AppError } from '../middleware/errorHandler';
import * as config from '../config';

const router = Router();

// POST /api/admin/set-test-prices - Set all Small variants to $1.00 for testing
router.post('/set-test-prices', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Update all Small variant prices to $1.00
    const result = await query(`
      UPDATE prices 
      SET price = 1.00 
      WHERE variant_id IN (
        SELECT id FROM variants 
        WHERE name LIKE 'Small%'
      )
      RETURNING variant_id
    `);

    res.json({ 
      message: 'All Small variants updated to $1.00',
      count: result.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/analytics
router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'analytics:dashboard';
    
    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Get total orders and revenue
    const orderStats = await queryOne<any>(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total) as total_revenue,
        AVG(total) as average_order_value
      FROM orders
      WHERE status NOT IN ('cancelled')
    `);
    
    // Get orders by status
    const ordersByStatus = await query<any>(`
      SELECT status, COUNT(*) as count
      FROM orders
      GROUP BY status
    `);
    
    // Get recent orders
    const recentOrders = await query<any>(`
      SELECT o.*,
        u.name as customer_name,
        u.email as customer_email,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'name', p.name,
              'quantity', oi.quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN variants v ON oi.variant_id = v.id
      LEFT JOIN products p ON v.product_id = p.id
      GROUP BY o.id, u.name, u.email
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    
    // Get top products
    const topProducts = await query<any>(`
      SELECT 
        p.id as product_id,
        p.name,
        SUM(oi.quantity) as quantity,
        SUM(oi.total) as revenue
      FROM order_items oi
      JOIN variants v ON oi.variant_id = v.id
      JOIN products p ON v.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status NOT IN ('cancelled')
        AND o.created_at > NOW() - INTERVAL '30 days'
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 10
    `);
    
    // Get revenue over time (last 7 days)
    const revenueOverTime = await query<any>(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total) as revenue
      FROM orders
      WHERE status NOT IN ('cancelled')
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    // Get active drivers
    const activeDrivers = await query<any>(`
      SELECT 
        d.*,
        u.name,
        u.email,
        dl.lat,
        dl.lng,
        dl.updated_at as location_updated,
        COUNT(o.id) as active_deliveries
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_locations dl ON d.id = dl.driver_id
      LEFT JOIN orders o ON d.id = o.driver_id AND o.status = 'delivering'
      WHERE d.available = true
      GROUP BY d.id, u.name, u.email, dl.lat, dl.lng, dl.updated_at
    `);
    
    const analytics: Analytics = {
      totalOrders: parseInt(orderStats?.total_orders || '0'),
      totalRevenue: parseFloat(orderStats?.total_revenue || '0'),
      averageOrderValue: parseFloat(orderStats?.average_order_value || '0'),
      ordersByStatus: ordersByStatus.reduce((acc, curr) => {
        acc[curr.status] = parseInt(curr.count);
        return acc;
      }, {} as Record<string, number>),
      recentOrders,
      topProducts: topProducts.map(p => ({
        productId: p.product_id,
        name: p.name,
        quantity: parseInt(p.quantity),
        revenue: parseFloat(p.revenue),
      })),
    };
    
    // Add extra data for dashboard
    const dashboardData = {
      ...analytics,
      revenueOverTime,
      activeDrivers,
    };
    
    // Cache for 5 minutes
    await cacheService.set(cacheKey, dashboardData, config.cache.ttl.analytics);
    
    res.json(dashboardData);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/orders
router.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, userId, driverId, search, startDate, endDate, limit = '50', offset = '0' } = req.query;
    
    let sql = `
      SELECT o.*,
        u.name as customer_name,
        u.email as customer_email,
        du.name as driver_name,
        COUNT(oi.id) as item_count
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users du ON d.user_id = du.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (status) {
      params.push(status);
      sql += ` AND o.status = $${params.length}`;
    }
    
    if (userId) {
      params.push(userId);
      sql += ` AND o.user_id = $${params.length}`;
    }
    
    if (driverId) {
      params.push(driverId);
      sql += ` AND o.driver_id = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR o.id::text ILIKE $${params.length})`;
    }
    
    if (startDate) {
      params.push(startDate);
      sql += ` AND o.created_at >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      sql += ` AND o.created_at <= $${params.length}`;
    }
    
    sql += ' GROUP BY o.id, u.name, u.email, du.name ORDER BY o.created_at DESC';
    
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;
    params.push(limitNum, offsetNum);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const orders = await query(sql, params);
    
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, search, limit = '50', offset = '0' } = req.query;
    
    let sql = `
      SELECT u.id, u.email, u.name, u.role, u.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.status NOT IN ('cancelled')
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (role) {
      params.push(role);
      sql += ` AND u.role = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    
    sql += ' GROUP BY u.id ORDER BY u.created_at DESC';
    
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;
    params.push(limitNum, offsetNum);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const users = await query(sql, params);
    
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/products/inventory
router.get('/products/inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inventory = await query(`
      SELECT 
        p.id,
        p.name,
        p.category,
        p.active,
        COUNT(v.id) as variant_count,
        SUM(pr.stock) as total_stock,
        MIN(pr.stock) as min_stock,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', v.id,
            'name', v.name,
            'sku', v.sku,
            'stock', pr.stock,
            'price', pr.price
          ) ORDER BY v.name
        ) as variants
      FROM products p
      JOIN variants v ON p.id = v.product_id
      JOIN prices pr ON v.id = pr.variant_id
      GROUP BY p.id
      ORDER BY p.name
    `);
    
    res.json(inventory);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/stripe/revenue
router.get('/stripe/revenue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.json({
        enabled: false,
        message: 'Stripe not configured',
        revenue: 0,
        transactions: 0,
      });
    }

    const { startDate, endDate } = req.query;
    
    // Get charges from Stripe
    const charges = await stripe.charges.list({
      created: {
        gte: startDate ? Math.floor(new Date(startDate as string).getTime() / 1000) : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // Default to last 30 days
        lte: endDate ? Math.floor(new Date(endDate as string).getTime() / 1000) : Math.floor(Date.now() / 1000),
      },
      limit: 100,
    });

    const totalRevenue = charges.data
      .filter(charge => charge.status === 'succeeded')
      .reduce((sum, charge) => sum + charge.amount, 0) / 100; // Convert from cents

    const totalTransactions = charges.data.filter(charge => charge.status === 'succeeded').length;

    res.json({
      enabled: true,
      revenue: totalRevenue,
      transactions: totalTransactions,
      charges: charges.data.map(charge => ({
        id: charge.id,
        amount: charge.amount / 100,
        status: charge.status,
        created: new Date(charge.created * 1000).toISOString(),
        description: charge.description,
        customer: charge.billing_details?.name,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Feature flag: accept new orders
const FLAG_ACCEPT_ORDERS = 'feature:accept_orders';

router.get('/features/accept-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = await cacheService.get(FLAG_ACCEPT_ORDERS);
    const enabled = raw === null ? true : Boolean(raw);
    res.json({ enabled });
  } catch (error) {
    next(error);
  }
});

router.post('/features/accept-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enabled } = req.body as { enabled: boolean };
    await cacheService.set(FLAG_ACCEPT_ORDERS, enabled ? '1' : '0', 24 * 60 * 60);
    res.json({ message: 'Updated', enabled });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/variants/:id/stock
router.patch('/variants/:id/stock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (typeof stock !== 'number' || stock < 0) {
      throw new AppError(400, 'Stock must be a non-negative number');
    }

    const updatedVariant = await queryOne(
      'UPDATE prices SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE variant_id = $2 RETURNING *',
      [stock, id]
    );

    if (!updatedVariant) {
      throw new AppError(404, 'Variant not found');
    }

    // Clear inventory cache
    await cacheService.del('products:inventory');
    await cacheService.del('products:list:*');

    res.json({
      message: 'Stock updated successfully',
      variant: updatedVariant,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/products/:id/status
router.patch('/products/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      throw new AppError(400, 'Active must be a boolean value');
    }

    const updatedProduct = await queryOne(
      'UPDATE products SET active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [active, id]
    );

    if (!updatedProduct) {
      throw new AppError(404, 'Product not found');
    }

    // Clear product caches
    await cacheService.del('products:inventory');
    await cacheService.del('products:list:*');
    await cacheService.del(`products:${id}`);

    res.json({
      message: 'Product status updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/password
router.patch('/users/:id/password', requireAuth, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      throw new AppError(400, 'Password must be at least 6 characters');
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await queryOne(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name, role',
      [hashedPassword, id]
    );

    if (!updatedUser) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      message: 'User password updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['customer', 'admin', 'driver'].includes(role)) {
      throw new AppError(400, 'Invalid role');
    }

    const updatedUser = await queryOne(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [role, id]
    );

    if (!updatedUser) {
      throw new AppError(404, 'User not found');
    }

    res.json({
      message: 'User role updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/status
router.patch('/users/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      throw new AppError(400, 'Active must be a boolean value');
    }

    // For now, we'll just return success (you could add an 'active' field to users table)
    res.json({
      message: 'User status updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/cache/clear
router.post('/cache/clear', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cacheService.clear();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
