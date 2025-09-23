import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';
import { cacheService } from '../services/cache';
import { embed, cosineSim } from '../services/ai';

const router = Router();

async function getProducts() {
  const products = await query<any>(`
    SELECT p.id, p.name, p.description, p.category, p.image_url
    FROM products p WHERE p.active = true
  `);
  return products.map(p => ({
    ...p,
    text: `${p.name}. ${p.description || ''}`.trim(),
  }));
}

// Fallback keyword search
async function keywordSearch(q: string) {
  const rows = await query<any>(
    `SELECT id, name, description, category, image_url
     FROM products WHERE active = true AND (name ILIKE $1 OR description ILIKE $1)
     ORDER BY name LIMIT 10`,
    [`%${q}%`]
  );
  return rows.map(r => ({ ...r, score: 0 }));
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) return res.json({ results: [] });

    try {
      const [products, qvec] = await Promise.all([getProducts(), embed(q)]);
      const scores: Array<{ product: any; score: number }> = [];
      for (const p of products) {
        const key = `pvec:${p.id}`;
        let vecStr = await cacheService.get(key);
        let pvec: number[];
        if (vecStr) {
          pvec = JSON.parse(vecStr);
        } else {
          pvec = await embed(p.text);
          await cacheService.set(key, JSON.stringify(pvec), 30 * 24 * 60 * 60);
        }
        const score = cosineSim(qvec, pvec);
        scores.push({ product: p, score });
      }
      scores.sort((a, b) => b.score - a.score);
      return res.json({ results: scores.slice(0, 10).map(s => ({ ...s.product, score: Number(s.score.toFixed(4)) })) });
    } catch (e) {
      console.warn('Embedding search failed, using keyword fallback:', (e as any)?.message);
      const results = await keywordSearch(q);
      return res.json({ results });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.query.productId as string;
    if (!productId) return res.json({ results: [] });

    try {
      const products = await getProducts();
      const seed = products.find(p => p.id === productId);
      if (!seed) return res.json({ results: [] });
      const seedVec = await embed(seed.text);
      const scores: Array<{ product: any; score: number }> = [];
      for (const p of products) {
        if (p.id === productId) continue;
        const key = `pvec:${p.id}`;
        let vecStr = await cacheService.get(key);
        let pvec: number[] = vecStr ? JSON.parse(vecStr) : await embed(p.text);
        if (!vecStr) await cacheService.set(key, JSON.stringify(pvec), 30 * 24 * 60 * 60);
        const score = cosineSim(seedVec, pvec);
        scores.push({ product: p, score });
      }
      scores.sort((a, b) => b.score - a.score);
      return res.json({ results: scores.slice(0, 6).map(s => ({ ...s.product, score: Number(s.score.toFixed(4)) })) });
    } catch (e) {
      console.warn('Embedding recommendations failed, using category fallback:', (e as any)?.message);
      const rows = await query<any>(
        `SELECT id, name, description, category, image_url
         FROM products WHERE active = true AND category = (
           SELECT category FROM products WHERE id = $1
         ) AND id <> $1
         ORDER BY created_at DESC LIMIT 6`,
        [productId]
      );
      return res.json({ results: rows.map(r => ({ ...r, score: 0 })) });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
