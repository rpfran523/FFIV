-- Clear existing data
DELETE FROM analytics;
DELETE FROM driver_locations;
DELETE FROM payment_methods;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM prices;
DELETE FROM variants;
DELETE FROM products;
DELETE FROM drivers;
DELETE FROM users;

-- Insert demo users
-- Password for all users is hashed version of their username + '123' (e.g., admin123, driver123, customer123)
-- These are bcrypt hashes with salt rounds of 10
INSERT INTO users (id, email, password, name, phone, role, email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@flowerfairies.com', '$2a$10$K8Y0xVD0Y.XmzBryMBhDiOZCAF8xEoF.eZLYHPnP8TtRz5KsJu.Ky', 'Admin User', '+1-555-0001', 'admin', true),
('550e8400-e29b-41d4-a716-446655440002', 'driver1@flowerfairies.com', '$2a$10$v/7NfKx4iruzPO5EYqCpDOSAcgN7ZoiABH/h6aJbpF8HbNcIK8sLu', 'Driver One', '+1-555-0002', 'driver', true),
('550e8400-e29b-41d4-a716-446655440003', 'driver2@flowerfairies.com', '$2a$10$LJJFjN5j7I0GQvJLnCqQ1eZB2sX/dXKoVDXthNI0jFz6Q5zKqKVEa', 'Driver Two', '+1-555-0003', 'driver', true),
('550e8400-e29b-41d4-a716-446655440004', 'customer1@flowerfairies.com', '$2a$10$TzW8U0OhNx9S5k0a5JMj.OdJBLASO5QrG6VV9HXCjqMKqfhAwJ7D6', 'Customer One', '+1-555-0004', 'customer', true),
('550e8400-e29b-41d4-a716-446655440005', 'customer2@flowerfairies.com', '$2a$10$gihE7HJQQrKH5DdqKX5fD.3SbeQJd5U.HcgIdpomQJnZxKg3HBkR.', 'Customer Two', '+1-555-0005', 'customer', true);

-- Insert drivers
INSERT INTO drivers (id, user_id, vehicle_type, license_plate, available) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Electric Bike', 'FAIRY01', true),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'Hybrid Car', 'FAIRY02', true);

-- Insert products (4 signature bouquets)
INSERT INTO products (id, name, description, category, image_url, base_price) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Twilight Blooms', 'Twilight Blooms is a balanced bouquet that lives up to its dreamy name, offering a serene blend of calm and gentle euphoria. The lift begins mellow and cerebral, easing away tension and inviting creativity, before melting into a soothing body relaxation that never feels too heavy. The perfect companion for enhancing quiet evenings or whatever you like to get into after a long day.', 'Bouquets', '/images/twilight-blooms.jpg', 50.00),
('750e8400-e29b-41d4-a716-446655440002', 'Tulip Trip', 'The Tulip Trip bouquet wraps you in comfort like a blanket of petals at dusk. The effects are deeply soothing—starting with a gentle wave of calm that quiets the mind, then blossoming into a full-body relaxation that encourages rest, recovery, and blissful ease. Ideal for late evenings or unhurried nights in.', 'Bouquets', '/images/tulip-trip.jpg', 50.00),
('750e8400-e29b-41d4-a716-446655440003', 'Fleur de Haze', 'Fleur de Haze is a lively bouquet that blossoms with bright energy and effortless charm. It delivers a clear, creative headspace paired with a light, euphoric body buzz that keeps the mood elevated without weighing you down. Take this one with you from pilates to HomeGoods with a lavender matcha or over orange wine with good company.', 'Bouquets', '/images/fleur-de-haze.jpg', 50.00),
('750e8400-e29b-41d4-a716-446655440004', 'Peony Dreams', 'Peony Dreams is a balanced bouquet designed to be a gentle muse for your favorite pastimes. It lifts the mind with clarity and focus, then wraps the body in an easy, comforting calm. Whether you're curled up with a novel, immersed in a game, or simply enjoying a creative hobby, Peony Dreams enhances the moment without overwhelming it. It's the strain that turns everyday interests into elevated rituals of relaxation.', 'Bouquets', '/images/peony-dreams.jpg', 50.00);

-- Insert variants with standardized sizing (all 4 products)
INSERT INTO variants (id, product_id, name, sku, attributes) VALUES
-- Twilight Blooms variants
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'Small (3.5g)', 'TWILIGHT-SM', '{"size": "small", "weight": "3.5g"}'),
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 'Medium (7g)', 'TWILIGHT-MD', '{"size": "medium", "weight": "7g"}'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', 'Large (14g)', 'TWILIGHT-LG', '{"size": "large", "weight": "14g"}'),
('850e8400-e29b-41d4-a716-446655440031', '750e8400-e29b-41d4-a716-446655440001', 'Extra Large (28g)', 'TWILIGHT-XL', '{"size": "extra_large", "weight": "28g"}'),
-- Tulip Trip variants
('850e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440002', 'Small (3.5g)', 'TULIP-SM', '{"size": "small", "weight": "3.5g"}'),
('850e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440002', 'Medium (7g)', 'TULIP-MD', '{"size": "medium", "weight": "7g"}'),
('850e8400-e29b-41d4-a716-446655440032', '750e8400-e29b-41d4-a716-446655440002', 'Large (14g)', 'TULIP-LG', '{"size": "large", "weight": "14g"}'),
('850e8400-e29b-41d4-a716-446655440033', '750e8400-e29b-41d4-a716-446655440002', 'Extra Large (28g)', 'TULIP-XL', '{"size": "extra_large", "weight": "28g"}'),
-- Fleur de Haze variants
('850e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440003', 'Small (3.5g)', 'HAZE-SM', '{"size": "small", "weight": "3.5g"}'),
('850e8400-e29b-41d4-a716-446655440034', '750e8400-e29b-41d4-a716-446655440003', 'Medium (7g)', 'HAZE-MD', '{"size": "medium", "weight": "7g"}'),
('850e8400-e29b-41d4-a716-446655440035', '750e8400-e29b-41d4-a716-446655440003', 'Large (14g)', 'HAZE-LG', '{"size": "large", "weight": "14g"}'),
('850e8400-e29b-41d4-a716-446655440036', '750e8400-e29b-41d4-a716-446655440003', 'Extra Large (28g)', 'HAZE-XL', '{"size": "extra_large", "weight": "28g"}'),
-- Peony Dreams variants
('850e8400-e29b-41d4-a716-446655440007', '750e8400-e29b-41d4-a716-446655440004', 'Small (3.5g)', 'PEONY-SM', '{"size": "small", "weight": "3.5g"}'),
('850e8400-e29b-41d4-a716-446655440037', '750e8400-e29b-41d4-a716-446655440004', 'Medium (7g)', 'PEONY-MD', '{"size": "medium", "weight": "7g"}'),
('850e8400-e29b-41d4-a716-446655440038', '750e8400-e29b-41d4-a716-446655440004', 'Large (14g)', 'PEONY-LG', '{"size": "large", "weight": "14g"}'),
('850e8400-e29b-41d4-a716-446655440039', '750e8400-e29b-41d4-a716-446655440004', 'Extra Large (28g)', 'PEONY-XL', '{"size": "extra_large", "weight": "28g"}');

-- Insert prices for variants with standardized pricing (all 4 products)
INSERT INTO prices (variant_id, price, stock) VALUES
-- Twilight Blooms prices
('850e8400-e29b-41d4-a716-446655440001', 50.00, 50),  -- Small (3.5g)
('850e8400-e29b-41d4-a716-446655440002', 65.00, 40),  -- Medium (7g)
('850e8400-e29b-41d4-a716-446655440003', 110.00, 30), -- Large (14g)
('850e8400-e29b-41d4-a716-446655440031', 180.00, 20), -- Extra Large (28g)
-- Tulip Trip prices
('850e8400-e29b-41d4-a716-446655440004', 50.00, 45),  -- Small (3.5g)
('850e8400-e29b-41d4-a716-446655440005', 65.00, 35),  -- Medium (7g)
('850e8400-e29b-41d4-a716-446655440032', 110.00, 25), -- Large (14g)
('850e8400-e29b-41d4-a716-446655440033', 180.00, 15), -- Extra Large (28g)
-- Fleur de Haze prices
('850e8400-e29b-41d4-a716-446655440006', 50.00, 40),  -- Small (3.5g)
('850e8400-e29b-41d4-a716-446655440034', 65.00, 30),  -- Medium (7g)
('850e8400-e29b-41d4-a716-446655440035', 110.00, 20), -- Large (14g)
('850e8400-e29b-41d4-a716-446655440036', 180.00, 12), -- Extra Large (28g)
-- Peony Dreams prices
('850e8400-e29b-41d4-a716-446655440007', 50.00, 38),  -- Small (3.5g)
('850e8400-e29b-41d4-a716-446655440037', 65.00, 28),  -- Medium (7g)
('850e8400-e29b-41d4-a716-446655440038', 110.00, 18), -- Large (14g)
('850e8400-e29b-41d4-a716-446655440039', 180.00, 10); -- Extra Large (28g)

-- Insert sample orders (no tax, new pricing)
INSERT INTO orders (id, user_id, status, subtotal, tax, delivery_fee, total, delivery_address, delivery_instructions, driver_id, created_at) VALUES
('950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'delivered', 65.00, 0.00, 8.00, 73.00, '123 Main St, Fairyland, FL 12345', 'Leave at front door', '650e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 days'),
('950e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', 'delivering', 50.00, 0.00, 8.00, 58.00, '123 Main St, Fairyland, FL 12345', 'Ring doorbell', '650e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '1 hour');

-- Insert order items
INSERT INTO order_items (order_id, variant_id, quantity, price_at_time, total) VALUES
-- Order 1 items (Medium Twilight Blooms)
('950e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440002', 1, 65.00, 65.00),
-- Order 2 items (Small Fleur de Haze)
('950e8400-e29b-41d4-a716-446655440002', '850e8400-e29b-41d4-a716-446655440006', 1, 50.00, 50.00);

-- Insert driver locations for active drivers
INSERT INTO driver_locations (driver_id, lat, lng) VALUES
('650e8400-e29b-41d4-a716-446655440001', 37.7749, -122.4194),
('650e8400-e29b-41d4-a716-446655440002', 37.7849, -122.4094);

-- Insert some analytics data
INSERT INTO analytics (date, metric_name, metric_value) VALUES
(CURRENT_DATE, 'daily_orders', '{"count": 15, "revenue": 1234.56}'),
(CURRENT_DATE - INTERVAL '1 day', 'daily_orders', '{"count": 22, "revenue": 1876.43}'),
(CURRENT_DATE, 'top_products', '{"products": [{"id": "750e8400-e29b-41d4-a716-446655440001", "count": 5}, {"id": "750e8400-e29b-41d4-a716-446655440003", "count": 3}]}');
