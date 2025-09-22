import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/pool';
import { cacheService } from '../services/cache';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { Product, ProductVariant } from '../types';

const router = Router();

// GET /api/products
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, sort = 'name', order = 'asc', limit = '50', offset = '0' } = req.query;
    
    // Build cache key
    const cacheKey = `products:list:${category || 'all'}:${search || ''}:${sort}:${order}:${limit}:${offset}`;
    
    // Try to get from cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Build query - simplified to avoid JSON aggregation issues
    let sql = `
      SELECT p.id, p.name, p.description, p.category, 
             p.image_url as "imageUrl", p.base_price as "basePrice", 
             p.created_at as "createdAt", p.updated_at as "updatedAt"
      FROM products p
      WHERE p.active = true
    `;
    
    const params: any[] = [];
    
    // Add filters
    if (category) {
      params.push(category);
      sql += ` AND p.category = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }
    
    // Add sorting
    const allowedSortFields = ['name', 'base_price', 'created_at'];
    const sortField = allowedSortFields.includes(sort as string) ? sort : 'name';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
    sql += ` ORDER BY p.${sortField} ${sortOrder}`;
    
    // Add pagination
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;
    params.push(limitNum, offsetNum);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const products = await query<any>(sql, params);
    
    // Get variants for each product separately
    for (const product of products) {
      const variants = await query<any>(`
        SELECT v.id, v.name, v.sku, v.attributes,
               pr.price, pr.stock
        FROM variants v
        JOIN prices pr ON v.id = pr.variant_id
        WHERE v.product_id = $1
        ORDER BY v.name
      `, [product.id]);
      
      product.variants = variants;
    }
    
    // Get total count
    let countSql = 'SELECT COUNT(p.id) as total FROM products p WHERE p.active = true';
    const countParams: any[] = [];
    
    if (category) {
      countParams.push(category);
      countSql += ` AND p.category = $${countParams.length}`;
    }
    
    if (search) {
      countParams.push(`%${search}%`);
      countSql += ` AND (p.name ILIKE $${countParams.length} OR p.description ILIKE $${countParams.length})`;
    }
    
    const [{ total }] = await query<{ total: string }>(countSql, countParams);
    
    const result = {
      products,
      pagination: {
        total: parseInt(total),
        limit: limitNum,
        offset: offsetNum,
      },
    };
    
    // Cache the result
    await cacheService.set(cacheKey, result, config.cache.ttl.products);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/categories
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'products:categories';
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const categories = await query<{ category: string; count: string }>(
      'SELECT category, COUNT(*) as count FROM products WHERE active = true GROUP BY category ORDER BY category'
    );
    
    const result = categories.map(c => ({
      name: c.category,
      count: parseInt(c.count),
    }));
    
    await cacheService.set(cacheKey, result, config.cache.ttl.products);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/featured (must come before /:id route)
router.get('/featured', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'products:featured';
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    // Get best-selling products from recent orders
    const products = await query<any>(`
      SELECT p.id, p.name, p.description, p.category, 
             p.image_url as "imageUrl", p.base_price as "basePrice", 
             p.created_at as "createdAt", p.updated_at as "updatedAt",
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.quantity) as total_sold
      FROM products p
      LEFT JOIN variants v ON p.id = v.product_id
      LEFT JOIN order_items oi ON v.id = oi.variant_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.active = true
        AND (o.created_at > NOW() - INTERVAL '30 days' OR o.created_at IS NULL)
      GROUP BY p.id
      ORDER BY order_count DESC, p.created_at DESC
      LIMIT 8
    `);
    
    // Get variants for each product separately
    for (const product of products) {
      const variants = await query<any>(`
        SELECT v.id, v.name, v.sku, v.attributes,
               pr.price, pr.stock
        FROM variants v
        JOIN prices pr ON v.id = pr.variant_id
        WHERE v.product_id = $1
        ORDER BY v.name
      `, [product.id]);
      
      product.variants = variants;
    }
    
    await cacheService.set(cacheKey, products, config.cache.ttl.products);
    
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const cacheKey = `products:${id}`;
    
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const product = await queryOne<any>(`
      SELECT p.id, p.name, p.description, p.category, 
             p.image_url as "imageUrl", p.base_price as "basePrice", 
             p.created_at as "createdAt", p.updated_at as "updatedAt"
      FROM products p
      WHERE p.id = $1 AND p.active = true
    `, [id]);
    
    if (!product) {
      throw new AppError(404, 'Product not found');
    }
    
    // Get variants separately
    const variants = await query<any>(`
      SELECT v.id, v.name, v.sku, v.attributes,
             pr.price, pr.stock
      FROM variants v
      JOIN prices pr ON v.id = pr.variant_id
      WHERE v.product_id = $1
      ORDER BY v.name
    `, [id]);
    
    product.variants = variants;
    
    await cacheService.set(cacheKey, product, config.cache.ttl.products);
    
    res.json(product);
  } catch (error) {
    next(error);
  }
});

export default router;
