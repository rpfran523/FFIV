import Stripe from 'stripe';

export function stripeConfig() {
  const secret = process.env.STRIPE_SECRET_KEY || '';
  const pub = process.env.STRIPE_PUBLISHABLE_KEY || '';
  const wh = process.env.STRIPE_WEBHOOK_SECRET || '';
  const enabled = Boolean(secret && pub && wh);
  
  return { 
    enabled, 
    secret, 
    publishableKey: pub, 
    webhookSecret: wh 
  };
}

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const { secret, enabled } = stripeConfig();
  if (!enabled) return null;
  
  if (!stripeInstance) {
    stripeInstance = new Stripe(secret, { 
      apiVersion: '2024-06-20' as any,
    });
    console.log('✅ Stripe initialized');
  }
  
  return stripeInstance;
}

