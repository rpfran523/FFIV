#!/usr/bin/env node

const axios = require('axios');
const { join } = require('path');
const { existsSync } = require('fs');
const dotenv = require('dotenv');

const rootDir = join(__dirname, '..');

// Load environment variables
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const API_URL = process.env.API_URL || 'http://localhost:8080';
const TEST_EMAIL = 'smoketest@flowerfairies.com';
const TEST_PASSWORD = 'smoke123';

console.log('🔥 Starting Flower Fairies smoke test...');
console.log(`📡 API URL: ${API_URL}`);

let testsPassed = 0;
let testsFailed = 0;
let accessToken = null;

async function test(name, fn) {
  try {
    console.log(`\n📋 Testing: ${name}`);
    await fn();
    console.log(`✅ Passed: ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ Failed: ${name}`);
    console.error(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.error(`   Response: ${JSON.stringify(error.response.data)}`);
    }
    testsFailed++;
  }
}

// Configure axios
const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  validateStatus: () => true, // Don't throw on any status
});

// Main smoke test suite
async function runSmokeTests() {
  // Test 1: Health Check
  await test('Health Check', async () => {
    const response = await api.get('/health');
    if (response.status !== 200) {
      throw new Error(`Health check returned ${response.status}`);
    }
    if (!response.data.status === 'ok') {
      throw new Error('Health check status not ok');
    }
  });

  // Test 2: List Products (Public Endpoint)
  await test('List Products', async () => {
    const response = await api.get('/products');
    if (response.status !== 200) {
      throw new Error(`Products endpoint returned ${response.status}`);
    }
    if (!Array.isArray(response.data.products)) {
      throw new Error('Products response invalid');
    }
    console.log(`   Found ${response.data.products.length} products`);
  });

  // Test 3: Register Test User
  await test('Register User', async () => {
    // First try to clean up any existing test user
    const loginResponse = await api.post('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    if (loginResponse.status === 200) {
      console.log('   Test user already exists, skipping registration');
      accessToken = loginResponse.data.tokens?.accessToken || 
                   loginResponse.headers['set-cookie']?.find(c => c.includes('accessToken'));
      return;
    }

    const response = await api.post('/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: 'Smoke Test User',
    });

    if (response.status !== 201) {
      throw new Error(`Registration returned ${response.status}`);
    }
    
    accessToken = response.data.tokens?.accessToken;
    console.log('   User registered successfully');
  });

  // Test 4: Login
  await test('Login', async () => {
    const response = await api.post('/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (response.status !== 200) {
      throw new Error(`Login returned ${response.status}`);
    }

    accessToken = response.data.tokens?.accessToken;
    if (!accessToken) {
      // Check cookies
      const cookies = response.headers['set-cookie'];
      if (!cookies || !cookies.some(c => c.includes('accessToken'))) {
        throw new Error('No access token received');
      }
    }
    console.log('   Login successful');
  });

  // Test 5: Get User Profile (Authenticated)
  await test('Get User Profile', async () => {
    const response = await api.get('/auth/me', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    if (response.status !== 200) {
      throw new Error(`Profile endpoint returned ${response.status}`);
    }
    if (!response.data.user) {
      throw new Error('No user data returned');
    }
    console.log(`   User: ${response.data.user.name} (${response.data.user.email})`);
  });

  // Test 6: Create Test Order (Skip Stripe)
  await test('Create Order', async () => {
    // First get a product
    const productsResponse = await api.get('/products');
    if (!productsResponse.data.products?.length) {
      console.log('   No products available, skipping order test');
      return;
    }

    const product = productsResponse.data.products[0];
    const variant = product.variants?.[0];
    if (!variant) {
      console.log('   No product variants available, skipping order test');
      return;
    }

    const response = await api.post('/orders', {
      items: [{
        variantId: variant.id,
        quantity: 1,
      }],
      deliveryAddress: '123 Smoke Test St, Test City, TC 12345',
      deliveryInstructions: 'Smoke test order - please ignore',
    }, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    if (response.status === 201) {
      console.log(`   Order created: ${response.data.id}`);
      
      // Try to cancel the order to clean up
      await api.post(`/orders/${response.data.id}/cancel`, {}, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      console.log('   Order cancelled for cleanup');
    } else if (response.status === 429) {
      console.log('   Rate limited (expected behavior)');
    } else {
      throw new Error(`Order creation returned ${response.status}`);
    }
  });

  // Test 7: Check SSE Connection
  await test('SSE Events Endpoint', async () => {
    const response = await api.get('/events', {
      headers: {
        'Accept': 'text/event-stream',
      },
      responseType: 'stream',
      timeout: 2000,
    });

    if (response.status !== 200) {
      throw new Error(`SSE endpoint returned ${response.status}`);
    }
    
    // Just check that we can connect
    response.data.destroy();
    console.log('   SSE endpoint accessible');
  });

  // Test 8: Check Stripe Configuration
  await test('Stripe Configuration', async () => {
    const response = await api.get('/stripe/config');
    if (response.status !== 200) {
      throw new Error(`Stripe config returned ${response.status}`);
    }
    console.log(`   Stripe enabled: ${response.data.enabled}`);
  });
}

// Run tests and report results
async function main() {
  try {
    await runSmokeTests();
  } catch (error) {
    console.error('\n🚨 Unexpected error:', error.message);
    testsFailed++;
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Smoke Test Results:');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total: ${testsPassed + testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    console.log('\n⚠️  Some tests failed. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All smoke tests passed!');
    process.exit(0);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Check if server is running
console.log('⏳ Waiting for server...');
setTimeout(main, 2000);
