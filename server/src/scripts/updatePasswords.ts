import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import dotenv from 'dotenv';

dotenv.config();

async function updateDemoPasswords() {
  try {
    console.log('Updating demo user passwords to FullMoon1!!!...');
    
    // Hash the new password
    const newPassword = 'FullMoon1!!!';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // List of demo users to update
    const demoEmails = [
      'admin@flowerfairies.com',
      'customer@flowerfairies.com',
      'driver@flowerfairies.com',
      'john@example.com',
      'jane@example.com',
      'bob@driver.com',
      'alice@driver.com'
    ];
    
    // Update passwords for specific demo users
    const result1 = await query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE email = ANY($2::text[])
       RETURNING email`,
      [hashedPassword, demoEmails]
    );
    
    console.log(`Updated ${result1.length} specific demo users:`, result1.map(r => r.email));
    
    // Also update any other test users
    const result2 = await query(
      `UPDATE users 
       SET password = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE (email LIKE '%@example.com' 
          OR email LIKE '%@driver.com' 
          OR email LIKE '%test%')
          AND email NOT IN (SELECT unnest($2::text[]))
       RETURNING email`,
      [hashedPassword, demoEmails]
    );
    
    console.log(`Updated ${result2.length} additional test users:`, result2.map(r => r.email));
    
    console.log('\n✅ All demo passwords updated successfully!');
    console.log('New password for all demo users: FullMoon1!!!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating passwords:', error);
    process.exit(1);
  }
}

// Run the update
updateDemoPasswords();