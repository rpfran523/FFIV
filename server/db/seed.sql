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

-- Insert products (only 3 for now)
INSERT INTO products (id, name, description, category, image_url, base_price) VALUES
('750e8400-e29b-41d4-a716-446655440001', 'Rose Bouquet', 'Classic red roses arranged with baby''s breath and eucalyptus', 'Bouquets', 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=800', 50.00),
('750e8400-e29b-41d4-a716-446655440002', 'Spring Garden Mix', 'Colorful mix of seasonal spring flowers', 'Bouquets', 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=800', 50.00),
('750e8400-e29b-41d4-a716-446655440003', 'Lavender Dreams', 'Fresh lavender stems with white roses', 'Bouquets', 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=800', 50.00);

-- Insert variants with standardized sizing (only for 3 products)
INSERT INTO variants (id, product_id, name, sku, attributes) VALUES
-- Rose Bouquet variants
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', 'Small (3.5)', 'ROSE-SM', '{"size": "small", "stems": "3.5"}'),
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440001', 'Medium (7)', 'ROSE-MD', '{"size": "medium", "stems": "7"}'),
('850e8400-e29b-41d4-a716-446655440003', '750e8400-e29b-41d4-a716-446655440001', 'Large (14)', 'ROSE-LG', '{"size": "large", "stems": "14"}'),
('850e8400-e29b-41d4-a716-446655440031', '750e8400-e29b-41d4-a716-446655440001', 'Extra Large (28)', 'ROSE-XL', '{"size": "extra_large", "stems": "28"}'),
-- Spring Garden Mix variants
('850e8400-e29b-41d4-a716-446655440004', '750e8400-e29b-41d4-a716-446655440002', 'Small (3.5)', 'SPRING-SM', '{"size": "small", "stems": "3.5"}'),
('850e8400-e29b-41d4-a716-446655440005', '750e8400-e29b-41d4-a716-446655440002', 'Medium (7)', 'SPRING-MD', '{"size": "medium", "stems": "7"}'),
('850e8400-e29b-41d4-a716-446655440032', '750e8400-e29b-41d4-a716-446655440002', 'Large (14)', 'SPRING-LG', '{"size": "large", "stems": "14"}'),
('850e8400-e29b-41d4-a716-446655440033', '750e8400-e29b-41d4-a716-446655440002', 'Extra Large (28)', 'SPRING-XL', '{"size": "extra_large", "stems": "28"}'),
-- Lavender Dreams variants
('850e8400-e29b-41d4-a716-446655440006', '750e8400-e29b-41d4-a716-446655440003', 'Small (3.5)', 'LAV-SM', '{"size": "small", "stems": "3.5"}'),
('850e8400-e29b-41d4-a716-446655440034', '750e8400-e29b-41d4-a716-446655440003', 'Medium (7)', 'LAV-MD', '{"size": "medium", "stems": "7"}'),
('850e8400-e29b-41d4-a716-446655440035', '750e8400-e29b-41d4-a716-446655440003', 'Large (14)', 'LAV-LG', '{"size": "large", "stems": "14"}'),
('850e8400-e29b-41d4-a716-446655440036', '750e8400-e29b-41d4-a716-446655440003', 'Extra Large (28)', 'LAV-XL', '{"size": "extra_large", "stems": "28"}');

-- Insert prices for variants with standardized pricing (only for 3 products)
INSERT INTO prices (variant_id, price, stock) VALUES
-- Rose Bouquet prices
('850e8400-e29b-41d4-a716-446655440001', 50.00, 50),  -- Small (3.5)
('850e8400-e29b-41d4-a716-446655440002', 65.00, 40),  -- Medium (7)
('850e8400-e29b-41d4-a716-446655440003', 110.00, 30), -- Large (14)
('850e8400-e29b-41d4-a716-446655440031', 180.00, 20), -- Extra Large (28)
-- Spring Garden Mix prices
('850e8400-e29b-41d4-a716-446655440004', 50.00, 45),  -- Small (3.5)
('850e8400-e29b-41d4-a716-446655440005', 65.00, 35),  -- Medium (7)
('850e8400-e29b-41d4-a716-446655440032', 110.00, 25), -- Large (14)
('850e8400-e29b-41d4-a716-446655440033', 180.00, 15), -- Extra Large (28)
-- Lavender Dreams prices
('850e8400-e29b-41d4-a716-446655440006', 50.00, 40),  -- Small (3.5)
('850e8400-e29b-41d4-a716-446655440034', 65.00, 30),  -- Medium (7)
('850e8400-e29b-41d4-a716-446655440035', 110.00, 20), -- Large (14)
('850e8400-e29b-41d4-a716-446655440036', 180.00, 12); -- Extra Large (28)

-- Insert sample orders (no tax, new pricing)
INSERT INTO orders (id, user_id, status, subtotal, tax, delivery_fee, total, delivery_address, delivery_instructions, driver_id, created_at) VALUES
('950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'delivered', 65.00, 0.00, 8.00, 73.00, '123 Main St, Fairyland, FL 12345', 'Leave at front door', '650e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 days'),
('950e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', 'delivering', 50.00, 0.00, 8.00, 58.00, '123 Main St, Fairyland, FL 12345', 'Ring doorbell', '650e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '1 hour');

-- Insert order items
INSERT INTO order_items (order_id, variant_id, quantity, price_at_time, total) VALUES
-- Order 1 items (Medium Rose Bouquet)
('950e8400-e29b-41d4-a716-446655440001', '850e8400-e29b-41d4-a716-446655440002', 1, 65.00, 65.00),
-- Order 2 items (Small Lavender Dreams)
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
