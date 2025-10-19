import React, { ReactNode, useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { api } from '../lib/api';

interface StripeProviderProps {
  children: ReactNode;
}

let stripePromise: Promise<Stripe | null> | null = null;

export const StripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<{ enabled: boolean; publishableKey?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch Stripe config once on mount
  useEffect(() => {
    api.get('/stripe/config')
      .then(response => {
        const cfg = response.data;
        setConfig(cfg);
        
        // Initialize Stripe if enabled
        if (cfg.enabled && cfg.publishableKey && !stripePromise) {
          console.log('🔑 Initializing Stripe with publishable key');
          stripePromise = loadStripe(cfg.publishableKey);
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch Stripe config:', err);
        setConfig({ enabled: false });
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-600">Loading payment system...</div>
    </div>;
  }

  // If Stripe is not enabled, render children without Stripe context
  if (!config?.enabled || !config?.publishableKey || !stripePromise) {
    console.log('⚠️ Stripe not enabled - rendering without payment context');
    return <>{children}</>;
  }

  // Render with Stripe Elements context
  return (
    <Elements
      stripe={stripePromise}
      options={{
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#ec4899',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '0.375rem',
          },
        },
      }}
    >
      {children}
    </Elements>
  );
};

export default StripeProvider;

