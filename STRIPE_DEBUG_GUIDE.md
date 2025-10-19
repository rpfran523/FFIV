# 🔍 Stripe Payment Debug Guide

## 🛠️ Fixes Applied

### 1. **CRITICAL: Fixed Variable Scope Issue** (server/src/routes/orders.ts) 🔥
- ✅ **Deployed:** Oct 19, 2025 - Commit 94d173f
- ✅ Fixed "stripeClientSecret is not defined" error
- ✅ Moved variable declarations outside transaction block
- ✅ Now `stripeClientSecret`, `paymentIntentId`, `totals`, and `totalCents` are properly scoped

### 2. **Fixed Error Handling** (server/src/routes/orders.ts)
- ✅ Moved error handling from GET /api/orders to POST /api/orders
- ✅ Now properly returns specific Stripe error messages instead of generic 500
- ✅ Added detailed error logging with status codes

### 3. **Enhanced Client-Side Debugging** (client/src/pages/CheckoutPage.tsx)
- ✅ Added console logging for order creation response
- ✅ Added console logging for payment client secret
- ✅ Improved error message extraction (checks both `error` and `message` fields)
- ✅ Added validation to ensure CardElement is ready before payment
- ✅ Fixed duplicate cardElement retrieval

### 4. **Improved Server Logging** (server/src/routes/orders.ts)
- ✅ Added detailed logging for Payment Intent creation
- ✅ Logs order ID, payment intent ID, and total amounts
- ✅ Warns if client secret is missing from response
- ✅ Ensures order ID is included in response

## 🧪 Testing Steps

1. **Deploy Changes**
   ```bash
   cd /Users/shawnfranklin/FFIV
   git add .
   git commit -m "Fix Stripe payment error handling and add debugging"
   git push origin main
   ```

2. **Wait for Deployment**
   - Check Render dashboard for deployment status
   - Wait for "Live" status (~2-3 minutes)

3. **Test Payment Flow**
   - Clear browser cache / use incognito mode
   - Go to https://flowerfairieschi.shop
   - Login as: customer1@flowerfairies.com / customer123
   - Add Small ($1.00) item to cart
   - Go to checkout
   - Enter delivery address
   - Enter test card: 4242 4242 4242 4242, any future date, any CVC

4. **Monitor Debug Output**
   - **Browser Console (F12):**
     - Look for "Order created successfully:" with order details
     - Look for "Confirming payment with client secret:"
     - Check for any error messages
   
   - **Network Tab:**
     - Filter by: `/api/orders`
     - Check POST request:
       - Request payload
       - Response status (should be 201)
       - Response body (should include `paymentClientSecret`)
   
   - **Render Logs:**
     - Look for "✅ Order [id] created with Payment Intent"
     - Check for "❌" error messages
     - Look for "💥 Create order error:" if it fails

## 🔍 Common Issues & Solutions

### Issue 1: "Payment system is loading"
**Cause:** Stripe not initialized
**Solution:** 
- Check browser console for Stripe loading errors
- Verify `/api/stripe/config` returns `{"enabled":true,"publishableKey":"pk_live_..."}`
- Hard refresh the page

### Issue 2: 500 Error on Order Creation
**Cause:** Server-side error (now should show specific message)
**Solution:**
- Check browser console for detailed error message
- Check Render logs for "💥 Create order error:"
- Verify all Stripe env vars are set in Render

### Issue 3: Redirect to checkout.link.com
**Cause:** Stripe Link trying to activate
**Solution:** Already fixed with `disableLink: true` and `payment_method_types: ['card']`

### Issue 4: "Invalid total. Minimum charge is $0.50"
**Cause:** Amount calculation issue
**Solution:** Already fixed with integer validation and 50 cent minimum

## 🔑 Environment Variables Check

In Render Dashboard, verify these are all set and from the SAME Stripe account:
- `STRIPE_SECRET_KEY` (starts with `sk_live_`)
- `STRIPE_PUBLISHABLE_KEY` (starts with `pk_live_`)
- `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)

**To verify keys match:**
1. Go to https://dashboard.stripe.com
2. Check you're in LIVE mode (not TEST)
3. Go to Developers → API keys
4. Verify publishable and secret keys match what's in Render

## 📝 If Payment Still Fails

1. **Capture Full Error:**
   ```javascript
   // In browser console after failure:
   console.log('Last API response:', performance.getEntriesByType('resource').filter(r => r.name.includes('/api/orders')).pop());
   ```

2. **Check Stripe Dashboard:**
   - Go to https://dashboard.stripe.com
   - Check Payments → All transactions
   - Look for failed Payment Intents
   - Check Developers → Logs for API errors

3. **Test with Different Card:**
   - Try: 5555 5555 5555 4444 (Mastercard)
   - Try: 3782 822463 10005 (Amex)

4. **Verify Webhook (if needed):**
   ```bash
   # In Stripe Dashboard:
   # Developers → Webhooks → Add endpoint
   # URL: https://flowerfairieschi.shop/api/stripe/webhook
   # Events: payment_intent.succeeded, payment_intent.payment_failed
   ```

## 🎯 Success Indicators

When payment works correctly, you'll see:
1. ✅ "Order created successfully:" in console
2. ✅ "Confirming payment with client secret:" in console  
3. ✅ "Payment successful! Order confirmed!" toast
4. ✅ Redirect to order details page
5. ✅ Order shows in My Orders with "processing" status
6. ✅ Payment shows in Stripe Dashboard

## 💡 Quick Fixes to Try

If still not working after deployment:
1. Clear all browser data for the site
2. Try a different browser
3. Try on desktop (not mobile) first
4. Ensure you're using HTTPS (not HTTP)
5. Check if any browser extensions are blocking Stripe

Good luck! The improved error handling should give you much clearer information about what's failing. 🚀
