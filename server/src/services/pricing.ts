/**
 * Pricing service - Tip-only model (no taxes, no fees)
 */

export interface OrderTotals {
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
}

export function computeTotals({ 
  subtotalCents, 
  tipCents = 0 
}: { 
  subtotalCents: number; 
  tipCents?: number;
}): OrderTotals {
  // Validate inputs
  if (subtotalCents < 0) {
    throw new Error('Subtotal cannot be negative');
  }
  
  if (tipCents < 0) {
    throw new Error('Tip cannot be negative');
  }

  // Simple calculation: total = subtotal + tip (no taxes, no fees)
  const totalCents = subtotalCents + tipCents;

  return {
    subtotalCents,
    tipCents,
    totalCents
  };
}

/**
 * Convert cents to dollars for display
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Convert dollars to cents for storage
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

