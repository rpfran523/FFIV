import { query } from '../db/pool';
import dotenv from 'dotenv';

dotenv.config();

async function updatePrices() {
  try {
    console.log('🌸 Updating Flower Fairies prices...\n');
    
    // Update Small (3.5) variants: $55 → $35
    console.log('Updating Small (3.5) variants from $55.00 to $35.00...');
    const smallResults = await query(
      `UPDATE prices 
       SET price = 35.00, updated_at = NOW()
       WHERE price = 55.00
       RETURNING id`,
      []
    );
    
    console.log(`✅ Updated ${smallResults.length} Small (3.5) variants`);
    
    // Update Medium (7) variants: $80 → $60
    console.log('\nUpdating Medium (7) variants from $80.00 to $60.00...');
    const mediumResults = await query(
      `UPDATE prices 
       SET price = 60.00, updated_at = NOW()
       WHERE price = 80.00
       RETURNING id`,
       []
    );
    
    console.log(`✅ Updated ${mediumResults.length} Medium (7) variants`);
    
    // Verify the changes
    console.log('\n📊 Verifying price changes...');
    const verification = await query(
      `SELECT 
        v.name as variant_name,
        p.price,
        COUNT(*) as count
       FROM prices p
       LEFT JOIN variants v ON p.variant_id = v.id
       WHERE p.price IN (35.00, 60.00)
       GROUP BY v.name, p.price
       ORDER BY p.price`,
      []
    );
    
    console.log('\nCurrent prices:');
    verification.forEach((row: any) => {
      console.log(`  ${row.variant_name}: $${row.price} (${row.count} items)`);
    });
    
    console.log('\n✅ All prices updated successfully!');
    console.log('   Small (3.5): $55.00 → $35.00');
    console.log('   Medium (7): $80.00 → $60.00');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating prices:', error);
    process.exit(1);
  }
}

// Run the update
updatePrices();
