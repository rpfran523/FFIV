import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../lib/api';
import { useCartStore } from '../lib/cart-store';
import { useAuth } from '../contexts/AuthContext';
import TipSelector from '../components/TipSelector';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { items, clearCart, getSubtotal, removeItem, updateQuantity } = useCartStore();
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [tipCents, setTipCents] = useState(0); // Tip in cents
  const [cardError, setCardError] = useState<string | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const [addressTyping, setAddressTyping] = useState('');

  useEffect(() => {
    const apiKey = (window as any).ENV_GOOGLE_PLACES_API_KEY || import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) return;
    const scriptId = 'google-places';
    const load = () => init();
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      s.async = true;
      s.onerror = () => console.warn('Google Places script failed to load');
      s.onload = load;
      document.body.appendChild(s);
    } else {
      load();
    }
    function init() {
      try {
        if (!(window as any).google?.maps?.places || !addressInputRef.current) return;
        const input = addressInputRef.current;
        input.setAttribute('autocomplete', 'off');
        const ac = new (window as any).google.maps.places.Autocomplete(input, { types: ['address'], fields: ['formatted_address'] });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (place?.formatted_address) setDeliveryAddress(place.formatted_address);
        });
      } catch (e) {
        console.warn('Places init error', e);
      }
    }
  }, []);

  // Debounce manual typing to keep deliveryAddress in sync without blocking
  useEffect(() => {
    const id = setTimeout(() => setDeliveryAddress(addressTyping), 300);
    return () => clearTimeout(id);
  }, [addressTyping]);

  const subtotal = getSubtotal();
  const tipDollars = tipCents / 100;
  const total = subtotal + tipDollars; // Subtotal + tip (no taxes, no fees)

  // Create order mutation - NO callbacks to prevent unmounting CardElement
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await api.post('/orders', orderData);
      return response.data;
    },
    // DO NOT add onSuccess/onError - they cause re-renders that unmount CardElement
  });

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to place an order');
      navigate('/auth');
      return;
    }

    if (user?.role !== 'customer') {
      toast.error('Only customers can place orders');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!deliveryAddress.trim()) {
      toast.error('Please enter a delivery address');
      return;
    }

    // Check if Stripe elements are ready
    if (!stripe || !elements) {
      console.error('Stripe not initialized:', { stripe: !!stripe, elements: !!elements });
      toast.error('Payment system is loading. Please wait...');
      return;
    }

    setIsPlacingOrder(true);

    try {
      // Get card element reference - do this AFTER setIsPlacingOrder to avoid race conditions
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        console.error('Card element not found');
        toast.error('Payment form not ready. Please refresh the page.');
        setIsPlacingOrder(false);
        return;
      }

      // Create order first (this creates Payment Intent on backend)
      const orderData = {
        items: items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        deliveryAddress: deliveryAddress.trim(),
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        tipCents,
        paymentMethod: { type: 'card' }, // Minimal info - Stripe handles the rest
      };

      const orderResponse = await createOrderMutation.mutateAsync(orderData);
      console.log('Order created successfully:', orderResponse);

      // Confirm payment with Stripe if we have a client secret
      if (orderResponse.paymentClientSecret && stripe && elements) {
        toast.success('Confirming payment...');
        console.log('Confirming payment with client secret:', orderResponse.paymentClientSecret);

        // Re-verify cardElement is still mounted before using it
        const cardElementForPayment = elements.getElement(CardElement);
        if (!cardElementForPayment) {
          console.error('CardElement unmounted before payment confirmation');
          throw new Error('Payment form was unmounted. Please try again.');
        }

        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
          orderResponse.paymentClientSecret,
          {
            payment_method: {
              card: cardElementForPayment,
              billing_details: {
                email: user?.email,
              },
            },
          }
        );

        if (stripeError) {
          // Payment failed - show detailed error
          console.error('Stripe payment error:', stripeError);
          toast.error(stripeError.message || 'Payment failed. Please check your card details.');
          setIsPlacingOrder(false);
          return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // Payment successful!
          clearCart();
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          toast.success('Payment successful! Order confirmed!');
          navigate(`/orders/${orderResponse.id}`);
        } else {
          // Payment requires further action (e.g., 3D Secure)
          toast.error('Payment requires additional authentication');
          setIsPlacingOrder(false);
        }
      } else {
        // No client secret - should not happen if Stripe is configured
        toast.error('Payment processing error. Please contact support.');
        setIsPlacingOrder(false);
      }
    } catch (error: any) {
      console.error('Order/Payment error:', error);
      // Extract the most specific error message available
      const errorMessage = 
        error.response?.data?.error || 
        error.response?.data?.message || 
        error.message || 
        'Failed to place order';
      toast.error(errorMessage);
      // Log additional details for debugging
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🔒</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to view your cart and checkout.</p>
          <Link
            to="/auth"
            className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (user?.role !== 'customer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🚫</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-6">Only customers can access the checkout page.</p>
          <Link
            to="/products"
            className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Checkout</h1>
        <p className="text-gray-600">Review your order and complete your purchase</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <span className="text-6xl mb-4 block">🛒</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Your Cart is Empty</h3>
          <p className="text-gray-600 mb-6">Add some beautiful flowers to your cart to continue.</p>
          <Link
            to="/products"
            className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Order Items</h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.variantId} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                    <img
                      src={item.product.imageUrl || 'https://via.placeholder.com/80'}
                      alt={item.product.name}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.product.name}</h3>
                        <p className="text-sm text-gray-600">{item.variant.name}</p>
                      </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(item.variant.price * item.quantity)}</p>
                      <button
                        onClick={() => removeItem(item.variantId)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {tipCents > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Tip</span>
                    <span>{formatCurrency(tipDollars)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <p className="text-green-600 text-sm text-center">🚚 Free delivery included!</p>
              </div>

              {/* Delivery Information */}
              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Address *
                  </label>
                  <input
                    id="address"
                    ref={addressInputRef}
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => { setDeliveryAddress(e.target.value); setAddressTyping(e.target.value); }}
                    placeholder="Enter your full delivery address..."
                    autoComplete="off"
                    inputMode="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Instructions (Optional)
                  </label>
                  <textarea
                    id="instructions"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g., Leave at front door, Ring doorbell..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={2}
                  />
                </div>
              </div>

              {/* Tip Selector */}
              <div className="mb-6">
                <TipSelector value={tipCents} onChange={setTipCents} />
              </div>

              {/* Payment Information */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-medium text-gray-900">💳 Payment Information</h3>
                
                {!stripe ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-gray-600 text-sm text-center">Loading secure payment form...</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Card Details *
                      </label>
                      <div className="border border-gray-300 rounded-md p-3 bg-white min-h-[40px]">
                        <CardElement
                          options={{
                            style: {
                              base: {
                                color: '#1f2937',
                                fontFamily: 'system-ui, sans-serif',
                                fontSize: '16px',
                                '::placeholder': {
                                  color: '#9ca3af',
                                },
                              },
                              invalid: {
                                color: '#ef4444',
                              },
                            },
                            disableLink: true, // Disable Stripe Link to prevent redirects
                          }}
                          onChange={(e) => {
                            setCardError(e.error ? e.error.message : null);
                          }}
                          onReady={() => {
                            console.log('✅ CardElement ready for input');
                          }}
                        />
                      </div>
                      {cardError && (
                        <p className="text-red-600 text-sm mt-2">{cardError}</p>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-blue-800 text-sm flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Your payment information is encrypted by Stripe
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || !deliveryAddress.trim() || items.length === 0 || !stripe || !!cardError}
                className="w-full bg-green-500 text-white py-3 px-6 rounded-md hover:bg-green-600 disabled:opacity-50 font-medium text-lg"
              >
                {isPlacingOrder ? 'Processing Payment...' : `Pay ${formatCurrency(total)}`}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                By placing this order, you agree to our terms of service and privacy policy.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
