import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, transaction } from '../db/pool';
import { authenticate, authorize } from '../middleware/auth';
import { orderLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { sseHub } from '../services/sse';
import { cacheService } from '../services/cache';

const router = Router();

// Validation schemas
const createOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      variantId: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
  deliveryAddress: Joi.string().required(),
  deliveryInstructions: Joi.string().optional(),
  paymentMethod: Joi.object({
    type: Joi.string().valid('card').required(),
    cardNumber: Joi.string().min(13).max(19).required(),
    expiryDate: Joi.string().pattern(/^\d{2}\/\d{2}$/).required(),
    cvv: Joi.string().min(3).max(4).required(),
    cardholderName: Joi.string().min(2).required(),
  }).required(),
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('processing', 'ready', 'delivering', 'delivered', 'cancelled').required(),
  driverId: Joi.string().uuid().optional(),
});

// Calculate order totals
const calculateOrderTotals = (subtotal: number) => {
  const total = subtotal; // Flat pricing - no delivery fee or tax
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: 0, // No tax
    deliveryFee: 0, // No delivery fee
    total: parseFloat(total.toFixed(2)),
  };
};

// GET /api/orders (customer gets their orders)
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;
    
    let sql = `
      SELECT o.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', oi.id,
              'variantId', oi.variant_id,
              'quantity', oi.quantity,
              'priceAtTime', oi.price_at_time,
              'total', oi.total,
              'variant', JSON_BUILD_OBJECT(
                'id', v.id,
                'name', v.name,
                'sku', v.sku,
                'attributes', v.attributes
              ),
              'product', JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'imageUrl', p.image_url
              )
            ) ORDER BY oi.created_at
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items,
        JSON_BUILD_OBJECT(
          'id', d.id,
          'vehicleType', d.vehicle_type,
          'user', JSON_BUILD_OBJECT(
            'name', u.name
          )
        ) as driver
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN variants v ON oi.variant_id = v.id
      LEFT JOIN products p ON v.product_id = p.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE o.user_id = $1
    `;
    
    const params: any[] = [req.user!.id];
    
    if (status) {
      params.push(status);
      sql += ` AND o.status = $${params.length}`;
    }
    
    sql += ' GROUP BY o.id, d.id, u.name ORDER BY o.created_at DESC';
    
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);
    const offsetNum = parseInt(offset as string) || 0;
    params.push(limitNum, offsetNum);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const orders = await query(sql, params);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const order = await queryOne<any>(`
      SELECT o.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', oi.id,
              'variantId', oi.variant_id,
              'quantity', oi.quantity,
              'priceAtTime', oi.price_at_time,
              'total', oi.total,
              'variant', JSON_BUILD_OBJECT(
                'id', v.id,
                'name', v.name,
                'sku', v.sku,
                'attributes', v.attributes
              ),
              'product', JSON_BUILD_OBJECT(
                'id', p.id,
                'name', p.name,
                'description', p.description,
                'imageUrl', p.image_url
              )
            ) ORDER BY oi.created_at
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items,
        JSON_BUILD_OBJECT(
          'id', d.id,
          'vehicleType', d.vehicle_type,
          'user', JSON_BUILD_OBJECT(
            'id', u.id,
            'name', u.name
          )
        ) as driver
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN variants v ON oi.variant_id = v.id
      LEFT JOIN products p ON v.product_id = p.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN users u ON d.user_id = u.id
      WHERE o.id = $1
      GROUP BY o.id, d.id, u.id, u.name
    `, [id]);
    
    if (!order) {
      throw new AppError(404, 'Order not found');
    }
    
    // Check if user owns this order or is admin/driver
    if (req.user!.role === 'customer' && order.user_id !== req.user!.id) {
      throw new AppError(403, 'Access denied');
    }
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders
router.post('/', authenticate, orderLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) throw error;
    
    const { items, deliveryAddress, deliveryInstructions, paymentMethod } = value;
    
    if (req.user!.role !== 'customer') {
      throw new AppError(403, 'Only customers can create orders');
    }
    
    const order = await transaction(async (client) => {
      let subtotal = 0;
      
      // Validate items and calculate subtotal
      for (const item of items) {
        const variant = await client.query(
          `SELECT v.*, pr.price, pr.stock 
           FROM variants v 
           JOIN prices pr ON v.id = pr.variant_id 
           WHERE v.id = $1`,
          [item.variantId]
        );
        
        if (!variant.rows[0]) {
          throw new AppError(404, `Variant ${item.variantId} not found`);
        }
        
        if (variant.rows[0].stock < item.quantity) {
          throw new AppError(400, `Insufficient stock for ${variant.rows[0].name}`);
        }
        
        subtotal += variant.rows[0].price * item.quantity;
      }
      
      // Calculate totals
      const totals = calculateOrderTotals(subtotal);
      
      // Create order
      const orderId = uuidv4();
      
      // Log payment method (in production, you'd process the payment here)
      console.log(`💳 Payment processed for order ${orderId}:`);
      console.log(`   Cardholder: ${paymentMethod.cardholderName}`);
      console.log(`   Card: ****${paymentMethod.cardNumber.slice(-4)}`);
      console.log(`   Amount: $${totals.total}`);
      
      await client.query(
        `INSERT INTO orders (id, user_id, status, subtotal, tax, delivery_fee, total, delivery_address, delivery_instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          orderId,
          req.user!.id,
          'pending',
          totals.subtotal,
          totals.tax,
          totals.deliveryFee,
          totals.total,
          deliveryAddress,
          deliveryInstructions
        ]
      );
      
      // Create order items and update stock
      for (const item of items) {
        const variant = await client.query(
          'SELECT v.*, pr.price FROM variants v JOIN prices pr ON v.id = pr.variant_id WHERE v.id = $1',
          [item.variantId]
        );
        
        const itemTotal = variant.rows[0].price * item.quantity;
        
        await client.query(
          `INSERT INTO order_items (order_id, variant_id, quantity, price_at_time, total)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.variantId, item.quantity, variant.rows[0].price, itemTotal]
        );
        
        // Update stock
        await client.query(
          'UPDATE prices SET stock = stock - $1 WHERE variant_id = $2',
          [item.quantity, item.variantId]
        );
      }
      
      return orderId;
    });
    
    // Fetch complete order data
    const newOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [order]);
    
    // Invalidate caches
    await cacheService.del('analytics:orders');
    
    // Notify via SSE
    sseHub.notifyNewOrder(newOrder);
    
    res.status(201).json(newOrder);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/orders/:id/status (admin/driver only)
router.patch('/:id/status', authenticate, authorize('admin', 'driver'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = updateOrderStatusSchema.validate(req.body);
    if (error) throw error;
    
    const { status, driverId } = value;
    
    // Get current order
    const currentOrder = await queryOne<any>('SELECT * FROM orders WHERE id = $1', [id]);
    if (!currentOrder) {
      throw new AppError(404, 'Order not found');
    }
    
    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      processing: ['ready', 'cancelled'],
      ready: ['delivering', 'cancelled'],
      delivering: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
    };
    
    if (!validTransitions[currentOrder.status].includes(status)) {
      throw new AppError(400, `Cannot transition from ${currentOrder.status} to ${status}`);
    }
    
    // Update order
    let sql = 'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [status];
    
    if (driverId && status === 'delivering') {
      params.push(driverId);
      sql += `, driver_id = $${params.length}`;
    }
    
    params.push(id);
    sql += ` WHERE id = $${params.length} RETURNING *`;
    
    const updatedOrder = await queryOne(sql, params);
    
    // Invalidate caches
    await cacheService.del('analytics:orders');
    
    // Notify via SSE
    sseHub.notifyOrderUpdate(updatedOrder);
    
    res.json(updatedOrder);
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/cancel (customer can cancel their own orders)
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const order = await queryOne<any>('SELECT * FROM orders WHERE id = $1', [id]);
    
    if (!order) {
      throw new AppError(404, 'Order not found');
    }
    
    // Check ownership
    if (order.user_id !== req.user!.id && req.user!.role !== 'admin') {
      throw new AppError(403, 'Access denied');
    }
    
    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(order.status)) {
      throw new AppError(400, 'Order cannot be cancelled at this stage');
    }
    
    // Cancel order and restore stock
    await transaction(async (client) => {
      // Update order status
      await client.query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['cancelled', id]
      );
      
      // Restore stock
      const items = await client.query(
        'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
        [id]
      );
      
      for (const item of items.rows) {
        await client.query(
          'UPDATE prices SET stock = stock + $1 WHERE variant_id = $2',
          [item.quantity, item.variant_id]
        );
      }
    });
    
    const cancelledOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [id]);
    
    // Invalidate caches
    await cacheService.del('analytics:orders');
    
    // Notify via SSE
    sseHub.notifyOrderUpdate(cancelledOrder);
    
    res.json(cancelledOrder);
  } catch (error) {
    next(error);
  }
});

export default router;
