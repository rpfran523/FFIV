-- Add tip column to orders table
ALTER TABLE orders 
ADD COLUMN tip DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (tip >= 0);

-- Update total calculation comment
COMMENT ON COLUMN orders.tip IS 'Optional tip amount in dollars (no taxes or fees)';
COMMENT ON COLUMN orders.total IS 'Total = subtotal + tip (no taxes or delivery fees)';

