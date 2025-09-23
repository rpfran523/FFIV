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

    // In a compiled JS file, __dirname refers to the directory of the file.
    // The db/ folder with SQL scripts will be copied to the same directory.
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const seedPath = path.join(__dirname, 'db', 'seed.sql');
    
    // Read and execute schema.sql
    console.log(`Executing schema.sql from ${schemaPath}...`);
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('✅ Schema created successfully.');

    // Read and execute seed.sql
    console.log('Executing seed.sql...');
    const seedSql = await fs.readFile(seedPath, 'utf8');
    await client.query(seedSql);
    console.log('✅ Database seeded successfully.');

    // TEMPORARY: Create a known-good admin user to bypass hashing issues
    console.log('🔧 Creating a guaranteed-valid admin user...');
    const { authService } = await import('../services/auth');
    const existingAdmin = await authService.findUserByEmail('testadmin@flowerfairies.com');
    if (!existingAdmin) {
      await authService.createUser(
        'testadmin@flowerfairies.com',
        'password123',
        'Test Admin',
        '1234567890',
        'admin'
      );
      console.log('✅ Guaranteed-valid admin user created.');
    } else {
      console.log('✅ Guaranteed-valid admin user already exists.');
    }

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
