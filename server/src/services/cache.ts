import Redis from 'ioredis';
import { config } from '../config';
import { CacheAdapter } from '../types';

class RedisCacheAdapter implements CacheAdapter {
  private client: Redis | null = null;

  async connect(): Promise<void> {
    if (config.redis.url) {
      try {
        this.client = new Redis(config.redis.url, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });

        this.client.on('error', (err) => {
          console.error('Redis error:', err);
        });

        this.client.on('connect', () => {
          console.log('✅ Connected to Redis');
        });

        // Test connection
        await this.client.ping();
      } catch (error) {
        console.warn('⚠️  Redis connection failed, falling back to in-memory cache');
        this.client = null;
      }
    }
  }

  async get(key: string): Promise<any | null> {
    if (!this.client) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.client) return;
    
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.client) return;
    
    try {
      await this.client.flushdb();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }
}

class InMemoryCacheAdapter implements CacheAdapter {
  private cache = new Map<string, { value: any; expiry?: number }>();
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (item.expiry && item.expiry <= now) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  async connect(): Promise<void> {
    console.log('✅ Using in-memory cache');
  }

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (item.expiry && item.expiry <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expiry = ttl ? Date.now() + (ttl * 1000) : undefined;
    this.cache.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  isConnected(): boolean {
    return true;
  }
}

class CacheService implements CacheAdapter {
  private adapter: CacheAdapter;

  constructor() {
    // Initialize with Redis adapter, will fallback to in-memory if connection fails
    this.adapter = new RedisCacheAdapter();
  }

  async connect(): Promise<void> {
    await this.adapter.connect();
    
    // If Redis connection failed, switch to in-memory adapter
    if (!this.adapter.isConnected()) {
      this.adapter = new InMemoryCacheAdapter();
      await this.adapter.connect();
    }
  }

  async get(key: string): Promise<any | null> {
    return this.adapter.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    return this.adapter.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    return this.adapter.del(key);
  }

  async clear(): Promise<void> {
    return this.adapter.clear();
  }

  async disconnect(): Promise<void> {
    return this.adapter.disconnect();
  }

  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  // Utility methods for common cache patterns
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached as T;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // For now, this is a simple implementation
    // In production, you might want to use Redis SCAN command
    if (pattern.includes('*')) {
      console.warn('Pattern invalidation not fully implemented for in-memory cache');
    } else {
      await this.del(pattern);
    }
  }
}

export const cacheService = new CacheService();
