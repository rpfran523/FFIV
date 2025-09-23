import { pool } from './pool';
import fs from 'fs/promises';
import path from 'path';

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔗 Checking database schema...');

    // Check if the 'users' table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ Database schema already exists.');
      return;
    }

    console.log('🟡 Tables not found. Initializing database...');

    // Find the absolute path to the sql files
    const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
    const seedPath = path.join(process.cwd(), 'server', 'db', 'seed.sql');
    
    // Read and execute schema.sql
    console.log('Executing schema.sql...');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('✅ Schema created successfully.');

    // Read and execute seed.sql
    console.log('Executing seed.sql...');
    const seedSql = await fs.readFile(seedPath, 'utf8');
    await client.query(seedSql);
    console.log('✅ Database seeded successfully.');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
