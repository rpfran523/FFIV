import { pool } from './pool';
import fs from 'fs';
import path from 'path';

// Use process.cwd() for CommonJS compatibility
const __dirname = path.join(process.cwd(), 'server', 'src', 'db');

export async function initializeDatabase() {
  try {
    // Test database connection with timeout
    console.log('🔗 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');

    // Check if tables exist
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📋 Database tables not found - they should be created manually');
      console.log('   Run schema.sql and seed.sql on your RDS instance');
    } else {
      console.log('✅ Database tables already exist');
      
      // Test a simple query to ensure everything works
      const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
      console.log(`✅ Found ${userCount.rows[0].count} users in database`);
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}
