#!/usr/bin/env node

/**
 * Quick test script to verify Stripe configuration
 * Run with: node test-stripe-config.js
 */

const https = require('https');

console.log('🔍 Testing Stripe Configuration...\n');

// Test 1: Check if API returns Stripe config
const checkStripeConfig = () => {
  return new Promise((resolve, reject) => {
    https.get('https://www.flowerfairieschi.shop/api/stripe/config', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const config = JSON.parse(data);
          console.log('✅ Stripe Config Endpoint Response:');
          console.log(`   Enabled: ${config.enabled}`);
          console.log(`   Publishable Key: ${config.publishableKey ? config.publishableKey.substring(0, 20) + '...' : 'NOT SET'}`);
          resolve(config);
        } catch (e) {
          console.error('❌ Failed to parse Stripe config:', e.message);
          reject(e);
        }
      });
    }).on('error', (err) => {
      console.error('❌ Failed to reach API:', err.message);
      reject(err);
    });
  });
};

// Test 2: Try to create a test order (requires auth)
const testOrderCreation = () => {
  console.log('\n📝 To test order creation manually:');
  console.log('1. Login as customer at https://www.flowerfairieschi.shop');
  console.log('2. Open browser console (F12)');
  console.log('3. Run this command:\n');
  
  const testCode = `
// Test order creation
fetch('/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    items: [{ variantId: 'YOUR_VARIANT_ID', quantity: 1 }],
    deliveryAddress: '123 Test St, Chicago IL',
    tipCents: 200,
    paymentMethod: { type: 'card' }
  })
})
.then(r => r.json())
.then(data => {
  console.log('Order Response:', data);
  if (data.paymentClientSecret) {
    console.log('✅ Payment Intent created successfully!');
    console.log('Client Secret:', data.paymentClientSecret.substring(0, 20) + '...');
  } else {
    console.log('❌ No payment client secret in response');
  }
})
.catch(err => console.error('Error:', err));`;

  console.log(testCode);
};

// Test 3: Check common issues
const checkCommonIssues = async (config) => {
  console.log('\n🔍 Checking Common Issues:');
  
  if (!config.enabled) {
    console.log('❌ Stripe is NOT enabled - check environment variables');
  }
  
  if (config.publishableKey && config.publishableKey.startsWith('pk_test_')) {
    console.log('⚠️  Using TEST mode keys - should be LIVE mode for production');
  }
  
  if (config.publishableKey && config.publishableKey.startsWith('pk_live_')) {
    console.log('✅ Using LIVE mode keys');
  }
  
  console.log('\n📋 Checklist:');
  console.log('[ ] All Stripe keys are from the SAME account');
  console.log('[ ] Using LIVE keys (not TEST keys)');
  console.log('[ ] Webhook secret matches the configured endpoint');
  console.log('[ ] Minimum amount is $0.50 (50 cents)');
  console.log('[ ] Card element shows and accepts input');
};

// Run tests
(async () => {
  try {
    const config = await checkStripeConfig();
    await checkCommonIssues(config);
    testOrderCreation();
    
    console.log('\n✅ Basic configuration looks good!');
    console.log('Next: Test the actual payment flow in the browser');
  } catch (error) {
    console.error('\n❌ Configuration check failed');
    process.exit(1);
  }
})();
