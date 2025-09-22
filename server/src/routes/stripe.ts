import express, { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { config } from '../config';

const router = Router();

// Initialize Stripe conditionally
let stripe: any = null;

async function initStripe() {
  if (config.stripe.secretKey && !stripe) {
    try {
      const Stripe = await import('stripe');
      stripe = new Stripe.default(config.stripe.secretKey, {
        apiVersion: '2023-10-16' as any,
      });
    } catch (error) {
      console.warn('Failed to initialize Stripe:', error);
    }
  }
}

// Initialize on first use
initStripe();

// Middleware to check if Stripe is configured
const requireStripe = (req: Request, res: Response, next: NextFunction) => {
  if (!stripe) {
    return res.status(501).json({
      error: {
        message: 'Payment processing is not configured',
        code: 'STRIPE_NOT_CONFIGURED',
      },
    });
  }
  next();
};

// Validation schemas
const createPaymentIntentSchema = Joi.object({
  amount: Joi.number().integer().min(50).required(), // Minimum 50 cents
  currency: Joi.string().default('usd'),
  metadata: Joi.object({
    orderId: Joi.string().uuid().required(),
  }).required(),
});

const confirmPaymentSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  paymentMethodId: Joi.string().required(),
});

// POST /api/stripe/payment-intents
router.post('/payment-intents', authenticate, requireStripe, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createPaymentIntentSchema.validate(req.body);
    if (error) throw error;

    const { amount, currency, metadata } = value;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        ...metadata,
        userId: req.user!.id,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
    });
  } catch (error: any) {
    if (error.type === 'StripeError') {
      next(new AppError(400, error.message));
    } else {
      next(error);
    }
  }
});

// POST /api/stripe/confirm-payment
router.post('/confirm-payment', authenticate, requireStripe, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = confirmPaymentSchema.validate(req.body);
    if (error) throw error;

    const { paymentIntentId, paymentMethodId } = value;

    // Confirm the payment
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    res.json({
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    if (error.type === 'StripeError') {
      next(new AppError(400, error.message));
    } else {
      next(error);
    }
  }
});

// POST /api/stripe/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response, next: NextFunction) => {
  if (!config.stripe.webhookSecret) {
    return res.status(501).json({ error: 'Webhook not configured' });
  }

  const sig = req.headers['stripe-signature'] as string;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as any;
        console.log('Payment succeeded:', paymentIntent.id);
        
        // Update order status if needed
        if (paymentIntent.metadata.orderId) {
          // You could update the order payment status here
          console.log('Order payment confirmed:', paymentIntent.metadata.orderId);
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as any;
        console.log('Payment failed:', failedPayment.id);
        
        // Handle failed payment
        if (failedPayment.metadata.orderId) {
          // You could update the order or notify the user
          console.log('Order payment failed:', failedPayment.metadata.orderId);
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// GET /api/stripe/config
router.get('/config', (req: Request, res: Response) => {
  res.json({
    enabled: !!stripe,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  });
});

// Test endpoint for Stripe (only in development)
if (config.env === 'development') {
  router.post('/test-charge', authenticate, requireStripe, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Create a test payment intent with a test card
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 100, // $1.00
        currency: 'usd',
        payment_method: 'pm_card_visa', // Test card
        confirm: true,
        metadata: {
          test: 'true',
          userId: req.user!.id,
        },
      });

      res.json({
        message: 'Test charge successful',
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });
    } catch (error: any) {
      next(new AppError(400, error.message));
    }
  });
}

// Conditional export to handle missing express import
export default router;
