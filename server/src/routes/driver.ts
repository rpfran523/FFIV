import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { requireAuth, requireRole } from '../middleware/auth';
import { query, queryOne } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { sseHub } from '../services/sse';

const router = Router();

// All routes require driver authentication
router.use(requireAuth);
router.use(authorize('driver'));

// Validation schemas
const updateLocationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const updateAvailabilitySchema = Joi.object({
  available: Joi.boolean().required(),
});

// GET /api/driver/profile
router.get('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const driver = await queryOne<any>(`
      SELECT d.*, u.name, u.email,
        dl.lat, dl.lng, dl.updated_at as location_updated,
        COUNT(o.id) as active_deliveries
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN driver_locations dl ON d.id = dl.driver_id
      LEFT JOIN orders o ON d.id = o.driver_id AND o.status = 'delivering'
      WHERE u.id = $1
      GROUP BY d.id, u.name, u.email, dl.lat, dl.lng, dl.updated_at
    `, [req.user!.id]);
    
    if (!driver) {
      throw new AppError(404, 'Driver profile not found');
    }
    
    res.json(driver);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/driver/availability
router.patch('/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateAvailabilitySchema.validate(req.body);
    if (error) throw error;
    
    const { available } = value;
    
    const driver = await queryOne<any>(
      'UPDATE drivers SET available = $1 WHERE user_id = $2 RETURNING *',
      [available, req.user!.id]
    );
    
    if (!driver) {
      throw new AppError(404, 'Driver not found');
    }
    
    res.json(driver);
  } catch (error) {
    next(error);
  }
});

// POST /api/driver/location
router.post('/location', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateLocationSchema.validate(req.body);
    if (error) throw error;
    
    const { lat, lng } = value;
    
    // Get driver ID
    const driver = await queryOne<any>(
      'SELECT id FROM drivers WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (!driver) {
      throw new AppError(404, 'Driver not found');
    }
    
    // Update or insert location
    await query(`
      INSERT INTO driver_locations (driver_id, lat, lng, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (driver_id) DO UPDATE
      SET lat = $2, lng = $3, updated_at = CURRENT_TIMESTAMP
    `, [driver.id, lat, lng]);
    
    // Broadcast location update
    sseHub.notifyDriverLocation(driver.id, { lat, lng });
    
    res.json({ message: 'Location updated' });
  } catch (error) {
    next(error);
  }
});

// GET /api/driver/orders/available
router.get('/orders/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await query<any>(`
      SELECT o.*,
        u.name as customer_name,
        COUNT(oi.id) as item_count
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = 'ready'
        AND o.driver_id IS NULL
      GROUP BY o.id, u.name
      ORDER BY o.created_at ASC
      LIMIT 20
    `);
    
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// GET /api/driver/orders/active
router.get('/orders/active', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const driver = await queryOne<any>(
      'SELECT id FROM drivers WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (!driver) {
      throw new AppError(404, 'Driver not found');
    }
    
    const orders = await query<any>(`
      SELECT o.*,
        u.name as customer_name,
        u.email as customer_email,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', oi.id,
              'quantity', oi.quantity,
              'product', p.name,
              'variant', v.name
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN variants v ON oi.variant_id = v.id
      LEFT JOIN products p ON v.product_id = p.id
      WHERE o.driver_id = $1
        AND o.status IN ('delivering')
      GROUP BY o.id, u.name, u.email
      ORDER BY o.created_at DESC
    `, [driver.id]);
    
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// POST /api/driver/orders/:id/accept
router.post('/orders/:id/accept', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Get driver
    const driver = await queryOne<any>(
      'SELECT id FROM drivers WHERE user_id = $1 AND available = true',
      [req.user!.id]
    );
    
    if (!driver) {
      throw new AppError(400, 'Driver not available');
    }
    
    // Try to claim the order
    const order = await queryOne<any>(`
      UPDATE orders 
      SET driver_id = $1, status = 'delivering', updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 
        AND status = 'ready'
        AND driver_id IS NULL
      RETURNING *
    `, [driver.id, id]);
    
    if (!order) {
      throw new AppError(400, 'Order is no longer available');
    }
    
    // Notify via SSE
    sseHub.notifyOrderUpdate(order);
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// POST /api/driver/orders/:id/complete
router.post('/orders/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { deliveryNotes, deliveryPhotoBase64 } = req.body;
    
    // Get driver
    const driver = await queryOne<any>(
      'SELECT id FROM drivers WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (!driver) {
      throw new AppError(404, 'Driver not found');
    }
    
    let photoUrl = null;
    
    // Handle photo upload if provided
    if (deliveryPhotoBase64) {
      try {
        // In production, you'd upload to AWS S3, Cloudinary, etc.
        // For now, we'll simulate the upload and store a placeholder URL
        photoUrl = `https://storage.flowerfairies.com/delivery-photos/${id}-${Date.now()}.jpg`;
        console.log(`📸 Delivery photo uploaded for order ${id}: ${photoUrl}`);
        console.log(`📸 Photo size: ${Math.round(deliveryPhotoBase64.length / 1024)}KB`);
      } catch (error) {
        console.error('Failed to upload delivery photo:', error);
        // Don't fail the delivery completion if photo upload fails
      }
    }
    
    // Complete the order with photo and notes
    const order = await queryOne<any>(`
      UPDATE orders 
      SET status = 'delivered', 
          delivered_at = CURRENT_TIMESTAMP,
          delivery_photo_url = $3,
          delivery_notes = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
        AND driver_id = $2
        AND status = 'delivering'
      RETURNING *
    `, [id, driver.id, photoUrl, deliveryNotes]);
    
    if (!order) {
      throw new AppError(400, 'Cannot complete this order');
    }
    
    // Notify via SSE
    sseHub.notifyOrderUpdate(order);
    
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// GET /api/driver/earnings
router.get('/earnings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    const driver = await queryOne<any>(
      'SELECT id FROM drivers WHERE user_id = $1',
      [req.user!.id]
    );
    
    if (!driver) {
      throw new AppError(404, 'Driver not found');
    }
    
    let sql = `
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(delivery_fee) as total_earnings,
        AVG(delivery_fee) as avg_earning_per_delivery,
        DATE(updated_at) as date,
        COUNT(*) as daily_deliveries,
        SUM(delivery_fee) as daily_earnings
      FROM orders
      WHERE driver_id = $1
        AND status = 'delivered'
    `;
    
    const params: any[] = [driver.id];
    
    if (startDate) {
      params.push(startDate);
      sql += ` AND updated_at >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      sql += ` AND updated_at <= $${params.length}`;
    }
    
    sql += ' GROUP BY DATE(updated_at) ORDER BY date DESC';
    
    const earnings = await query(sql, params);
    
    // Calculate totals
    const totals = await queryOne<any>(`
      SELECT 
        COUNT(*) as total_deliveries,
        SUM(delivery_fee) as total_earnings
      FROM orders
      WHERE driver_id = $1
        AND status = 'delivered'
        ${startDate ? `AND updated_at >= '${startDate}'` : ''}
        ${endDate ? `AND updated_at <= '${endDate}'` : ''}
    `, [driver.id]);
    
    res.json({
      totals,
      daily: earnings,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/driver/nearby?lat=..&lng=..&radiusKm=5
router.get('/nearby', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat((req.query.radiusKm as string) || '5');
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new AppError(400, 'lat and lng are required');
    }

    const drivers = await query<any>(`
      SELECT d.id, u.name, u.email,
             dl.lat::float8 as lat, dl.lng::float8 as lng, dl.updated_at,
             (
               6371 * acos(
                 cos(radians($1)) * cos(radians(dl.lat::float8)) * cos(radians(dl.lng::float8) - radians($2)) +
                 sin(radians($1)) * sin(radians(dl.lat::float8))
               )
             ) as distance_km
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      JOIN driver_locations dl ON dl.driver_id = d.id
      WHERE d.available = true
      HAVING (
        6371 * acos(
          cos(radians($1)) * cos(radians(dl.lat::float8)) * cos(radians(dl.lng::float8) - radians($2)) +
          sin(radians($1)) * sin(radians(dl.lat::float8))
        )
      ) <= $3
      ORDER BY distance_km ASC
      LIMIT 50
    `, [lat, lng, radiusKm]);

    res.json(drivers.map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      lat: Number(d.lat),
      lng: Number(d.lng),
      distanceKm: Number(d.distance_km),
      updatedAt: d.updated_at,
    })));
  } catch (error) {
    next(error);
  }
});

export default router;
