import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useCartStore } from '../lib/cart-store';
import { useAuth } from '../contexts/AuthContext';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { items, clearCart, getSubtotal, removeItem, updateQuantity } = useCartStore();
  const queryClient = useQueryClient();
  
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  const subtotal = getSubtotal();
  const total = subtotal; // No delivery fee - flat pricing

  // Check Stripe configuration
  const { data: stripeConfig } = useQuery({
    queryKey: ['stripe', 'config'],
    queryFn: async () => {
      const response = await api.get('/stripe/config');
      return response.data;
    },
  });

  // Create payment intent mutation
  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/stripe/payment-intents', {
        amount: Math.round(total * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          orderId: 'temp-order-id', // Will be replaced with actual order ID
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Payment intent created:', data.clientSecret);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to initialize payment');
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await api.post('/orders', orderData);
      return response.data;
    },
    onSuccess: (order) => {
      clearCart();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order placed successfully!');
      navigate(`/orders/${order.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to place order');
    },
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

    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
      toast.error('Please enter complete payment information');
      return;
    }

    setIsPlacingOrder(true);

    try {
      let paymentIntentId = null;

      // If Stripe is configured, create payment intent
      if (stripeConfig?.enabled) {
        const paymentIntent = await createPaymentIntentMutation.mutateAsync();
        paymentIntentId = paymentIntent.clientSecret;
        
        toast.success('Payment authorized! Completing order...');
      } else {
        toast.success('Processing order with manual payment...');
      }

      const orderData = {
        items: items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        deliveryAddress: deliveryAddress.trim(),
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        paymentMethod: {
          type: 'card',
          cardNumber: cardNumber.replace(/\s/g, ''),
          expiryDate,
          cvv,
          cardholderName,
        },
        paymentIntentId,
      };

      createOrderMutation.mutate(orderData);
    } catch (error) {
      toast.error('Payment processing failed');
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
                <div className="flex justify-between text-lg font-bold">
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
                  <textarea
                    id="address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter your full delivery address..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
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

              {/* Payment Information */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-medium text-gray-900">💳 Payment Information</h3>
                
                <div>
                  <label htmlFor="cardholderName" className="block text-sm font-medium text-gray-700 mb-2">
                    Cardholder Name *
                  </label>
                  <input
                    id="cardholderName"
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="Name on card"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Card Number *
                  </label>
                  <input
                    id="cardNumber"
                    type="text"
                    value={cardNumber}
                    onChange={(e) => {
                      // Format card number with spaces
                      const value = e.target.value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
                      if (value.replace(/\s/g, '').length <= 16) {
                        setCardNumber(value);
                      }
                    }}
                    placeholder="1234 5678 9012 3456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    maxLength={19}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date *
                    </label>
                    <input
                      id="expiryDate"
                      type="text"
                      value={expiryDate}
                      onChange={(e) => {
                        // Format MM/YY
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 4) {
                          const formatted = value.length >= 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
                          setExpiryDate(formatted);
                        }
                      }}
                      placeholder="MM/YY"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      maxLength={5}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-2">
                      CVV *
                    </label>
                    <input
                      id="cvv"
                      type="text"
                      value={cvv}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 4) {
                          setCvv(value);
                        }
                      }}
                      placeholder="123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-sm">
                    🔒 Your payment information is secure and encrypted
                  </p>
                </div>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || !deliveryAddress.trim() || items.length === 0 || !cardNumber || !expiryDate || !cvv || !cardholderName}
                className="w-full bg-green-500 text-white py-3 px-6 rounded-md hover:bg-green-600 disabled:opacity-50 font-medium text-lg"
              >
                {isPlacingOrder ? 'Processing Payment...' : `Pay ${formatCurrency(total)} with Card`}
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
