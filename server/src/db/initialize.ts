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

    const hasSchema = tableCheck.rows[0].exists;

    if (!hasSchema) {
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
    } else {
      console.log('✅ Database schema already exists.');
    }

    // Ensure demo user passwords are hashed by current runtime
    try {
      console.log('🔐 Ensuring demo user passwords match runtime hashing...');
      const { authService } = await import('../services/auth');
      const updates: Array<{ email: string; password: string }> = [
        { email: 'admin@flowerfairies.com', password: 'admin123' },
        { email: 'driver1@flowerfairies.com', password: 'driver123' },
        { email: 'driver2@flowerfairies.com', password: 'driver123' },
        { email: 'customer1@flowerfairies.com', password: 'customer123' },
        { email: 'customer2@flowerfairies.com', password: 'customer123' },
      ];

      for (const u of updates) {
        const hashed = await authService.hashPassword(u.password);
        await client.query('UPDATE users SET password = $1 WHERE email = $2', [hashed, u.email]);
      }
      console.log('✅ Demo passwords updated.');
    } catch (pwErr) {
      console.warn('⚠️ Failed to update demo passwords:', pwErr);
    }

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
