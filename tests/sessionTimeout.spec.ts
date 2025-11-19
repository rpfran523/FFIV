import { test, expect } from '@playwright/test';

test.describe('Session Timeout', () => {
  test('should logout user after 4 hours of inactivity', async ({ page, context }) => {
    // Navigate to login page
    await page.goto('https://www.flowerfairieschi.shop/auth');
    
    // Login as customer
    await page.fill('input[type="email"]', 'customer1@flowerfairies.com');
    await page.fill('input[type="password"]', 'FullMoon1!!!');
    await page.click('button[type="submit"]');
    
    // Wait for successful login and redirect
    await expect(page).toHaveURL(/\/(home|products)/, { timeout: 10000 });
    
    // Verify user is authenticated
    const userInfo = await page.evaluate(() => {
      return localStorage.getItem('current-user');
    });
    expect(userInfo).toBeTruthy();
    
    // Fast-forward time by 4 hours + 1 minute using page clock
    await page.clock.install({ time: new Date() });
    await page.clock.fastForward('04:01:00'); // 4 hours 1 minute
    
    // Trigger a check (the interval should fire)
    await page.waitForTimeout(1000);
    
    // User should be logged out and redirected to auth
    await expect(page).toHaveURL('/auth', { timeout: 5000 });
    
    // Verify tokens are cleared
    const tokenAfterTimeout = await page.evaluate(() => {
      return localStorage.getItem('ff_token');
    });
    expect(tokenAfterTimeout).toBeNull();
  });

  test('should logout user when access token expires', async ({ page }) => {
    // Navigate to login
    await page.goto('https://www.flowerfairieschi.shop/auth');
    
    // Login
    await page.fill('input[type="email"]', 'customer1@flowerfairies.com');
    await page.fill('input[type="password"]', 'FullMoon1!!!');
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await expect(page).toHaveURL(/\/(home|products)/, { timeout: 10000 });
    
    // Get the access token and manually expire it
    await page.evaluate(() => {
      const token = localStorage.getItem('ff_token');
      if (token) {
        // Create an expired token by modifying the payload
        // In real scenario, we'd wait for actual expiry or mock the JWT
        const parts = token.split('.');
        if (parts.length === 3) {
          // Decode payload
          const payload = JSON.parse(atob(parts[1]));
          // Set expiry to past
          payload.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
          // Re-encode (note: signature won't match but that's ok for client-side check)
          parts[1] = btoa(JSON.stringify(payload));
          localStorage.setItem('ff_token', parts.join('.'));
        }
      }
    });
    
    // Wait for periodic check to detect expiry
    await page.waitForTimeout(65000); // Wait just over 1 minute for check interval
    
    // Should be redirected to auth
    await expect(page).toHaveURL('/auth', { timeout: 5000 });
  });

  test('should keep user logged in with activity', async ({ page }) => {
    await page.goto('https://www.flowerfairieschi.shop/auth');
    
    // Login
    await page.fill('input[type="email"]', 'customer1@flowerfairies.com');
    await page.fill('input[type="password"]', 'FullMoon1!!!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/(home|products)/, { timeout: 10000 });
    
    // Install clock
    await page.clock.install({ time: new Date() });
    
    // Simulate activity every hour for 3.5 hours
    for (let i = 0; i < 4; i++) {
      await page.clock.fastForward('01:00:00'); // Forward 1 hour
      await page.mouse.move(100 + i * 10, 100 + i * 10); // Simulate mouse movement
      await page.waitForTimeout(100);
    }
    
    // User should still be logged in (didn't reach 4h inactivity)
    const isOnProtectedPage = await page.evaluate(() => {
      return window.location.pathname !== '/auth';
    });
    expect(isOnProtectedPage).toBeTruthy();
    
    // Token should still exist
    const hasToken = await page.evaluate(() => {
      return !!localStorage.getItem('ff_token');
    });
    expect(hasToken).toBeTruthy();
  });

  test('should handle 401 response and logout when refresh fails', async ({ page, context }) => {
    await page.goto('https://www.flowerfairieschi.shop/auth');
    
    // Login
    await page.fill('input[type="email"]', 'customer1@flowerfairies.com');
    await page.fill('input[type="password"]', 'FullMoon1!!!');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/(home|products)/, { timeout: 10000 });
    
    // Clear refresh token to simulate expired session
    await page.evaluate(() => {
      localStorage.removeItem('refreshToken');
    });
    
    // Try to access a protected API endpoint (this should trigger 401)
    await page.goto('https://www.flowerfairieschi.shop/account');
    
    // Should intercept 401, fail refresh, and redirect to auth
    await expect(page).toHaveURL('/auth', { timeout: 5000 });
  });
});
