# Stripe Payment Setup Guide

## Current Status: ⚠️ Manual Payment Mode

Your site currently accepts orders but **does NOT charge credit cards**. Orders complete successfully but no actual payment is processed.

---

## 🔒 To Enable Real Stripe Payments

### Step 1: Get Stripe Account & Keys

1. Sign up at https://dashboard.stripe.com
2. Navigate to **Developers** → **API keys**
3. Copy these keys:
   ```
   STRIPE_PUBLISHABLE_KEY=pk_test_... (for frontend)
   STRIPE_SECRET_KEY=sk_test_... (for backend)
   ```
4. For webhooks (later):
   - Go to **Developers** → **Webhooks**
   - Add endpoint: `https://flowerfairieschi.shop/api/stripe/webhook`
   - Copy `STRIPE_WEBHOOK_SECRET=whsec_...`

### Step 2: Add Keys to Render

In Render Dashboard → **flower-fairies** → **Environment**:

```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

Then click **Manual Deploy** → **Deploy latest commit**

### Step 3: Test Stripe Test Mode

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Any future expiry date (e.g., 12/25)
- Any 3-digit CVV (e.g., 123)

---

## ⚠️ Current Implementation Notes

**What the code does now:**
1. ✅ Collects card information
2. ✅ Creates order in database
3. ✅ Logs payment info (not secure for production)
4. ❌ Does NOT actually charge the card
5. ❌ Does NOT validate card with Stripe

**For production, you should:**
- Use Stripe Elements (secure card input)
- Never send raw card numbers to your backend
- Confirm payment intent before completing order
- Handle webhook events for payment status

---

## 🧪 Testing Payment Flow

**Without Stripe (Current):**
1. Add items to cart
2. Go to checkout
3. Enter any card info (not validated)
4. Order completes successfully
5. **No charge is made**

**With Stripe (After adding keys):**
1. Add items to cart
2. Go to checkout
3. Enter Stripe test card
4. Payment intent created
5. Order completes
6. **Actual test charge is made** (refundable)

---

## 📋 Quick Setup Checklist

- [ ] Get Stripe account
- [ ] Copy API keys from Stripe dashboard
- [ ] Add keys to Render environment variables
- [ ] Redeploy service
- [ ] Test with Stripe test card `4242 4242 4242 4242`
- [ ] Verify order completes and payment shows in Stripe dashboard

---

## 💡 For Now

Your site is fully functional for testing and demos. Orders work perfectly. When you're ready to accept real payments, just add the Stripe keys and redeploy!

