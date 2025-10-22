-- Update demo user passwords to FullMoon1!!!
-- The bcrypt hash below is for the password: FullMoon1!!!

UPDATE users 
SET password = '$2a$10$YKe14.4mOacPYFVLJqgUYuR7wRxN7IKhFKxKmZKEobpJ.ZyYqgXDO'
WHERE email IN (
    'admin@flowerfairies.com',
    'customer@flowerfairies.com', 
    'driver@flowerfairies.com',
    'john@example.com',
    'jane@example.com',
    'bob@driver.com',
    'alice@driver.com'
);

-- Also update any other test users that might exist
UPDATE users 
SET password = '$2a$10$YKe14.4mOacPYFVLJqgUYuR7wRxN7IKhFKxKmZKEobpJ.ZyYqgXDO'
WHERE email LIKE '%@example.com' 
   OR email LIKE '%@driver.com'
   OR email LIKE '%test%';