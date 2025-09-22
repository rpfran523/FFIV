import { Pool } from 'pg';
import { config } from '../config';

// Parse connection string to handle SSL properly
const isRDS = config.database.url.includes('rds.amazonaws.com');
const connectionConfig = {
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Add SSL configuration for RDS
if (isRDS) {
  connectionConfig.ssl = {
    rejectUnauthorized: false,
    ca: undefined, // Let Node.js use default CAs
  };
}

export const pool = new Pool(connectionConfig);

// Test connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
