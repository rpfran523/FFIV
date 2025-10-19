import React, { ReactNode } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';

interface StripeProviderProps {
  children: ReactNode;
}

let stripePromise: Promise<Stripe | null> | null = null;

export const StripeProvider: React.FC<StripeProviderProps> = ({ children }) => {
  // Fetch Stripe publishable key from backend
  const { data: stripeConfig, isLoading } = useQuery({
    queryKey: ['stripe', 'config'],
    queryFn: async () => {
      const response = await api.get('/stripe/config');
      return response.data;
    },
    staleTime: Infinity, // Config doesn't change during session
  });

  // Initialize Stripe with publishable key
  React.useEffect(() => {
    if (stripeConfig?.enabled && stripeConfig?.publishableKey && !stripePromise) {
      stripePromise = loadStripe(stripeConfig.publishableKey);
    }
  }, [stripeConfig]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // If Stripe is not enabled, render children without Stripe context
  if (!stripeConfig?.enabled || !stripeConfig?.publishableKey) {
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
            colorPrimary: '#ec4899', // Primary color (pink)
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

