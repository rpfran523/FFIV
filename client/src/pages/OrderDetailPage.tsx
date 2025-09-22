import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSSE } from '../contexts/SSEContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface OrderDetail {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  subtotal: number;
  tax: number;
  delivery_fee: number;
  total: number;
  delivery_address: string;
  delivery_instructions?: string;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  driver?: {
    id: string;
    vehicle_type: string;
    user: {
      id: string;
      name: string;
    };
  };
}

interface OrderItem {
  id: string;
  variant_id: string;
  quantity: number;
  price_at_time: number;
  total: number;
  variant: {
    id: string;
    name: string;
    sku: string;
    attributes: any;
  };
  product: {
    id: string;
    name: string;
    description: string;
    image_url: string;
  };
}

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { subscribe } = useSSE();
  const queryClient = useQueryClient();

  // Fetch order details
  const { data: order, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ['order', id],
    queryFn: async () => {
      const response = await api.get(`/orders/${id}`);
      return response.data;
    },
    enabled: !!id,
    refetchInterval: 30000, // Refresh every 30 seconds for status updates
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/orders/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order cancelled successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    },
  });

  // Subscribe to real-time order updates
  React.useEffect(() => {
    const unsubscribe = subscribe('order:updated', (data) => {
      if (data.orderId === id) {
        queryClient.invalidateQueries({ queryKey: ['order', id] });
        
        // Show status-specific notifications
        if (data.status === 'processing') {
          toast.success('Your order is being processed!');
        } else if (data.status === 'ready') {
          toast.success('Your order is ready for pickup/delivery!');
        } else if (data.status === 'delivering') {
          toast.success('Your order is out for delivery!');
        } else if (data.status === 'delivered') {
          toast.success('Your order has been delivered!');
        }
      }
    });

    return unsubscribe;
  }, [subscribe, queryClient, id]);

  const handleCancelOrder = () => {
    if (confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      cancelOrderMutation.mutate();
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: '⏳',
          description: 'Your order has been received and is waiting to be processed.',
          nextStep: 'We will start preparing your order soon.'
        };
      case 'processing':
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: '🔄',
          description: 'Your order is being prepared by our team.',
          nextStep: 'Your order will be ready for delivery soon.'
        };
      case 'ready':
        return {
          color: 'bg-purple-100 text-purple-800',
          icon: '📦',
          description: 'Your order is ready and waiting for a driver.',
          nextStep: 'A driver will pick up your order shortly.'
        };
      case 'delivering':
        return {
          color: 'bg-indigo-100 text-indigo-800',
          icon: '🚚',
          description: 'Your order is on its way to you!',
          nextStep: 'Expected delivery within the next hour.'
        };
      case 'delivered':
        return {
          color: 'bg-green-100 text-green-800',
          icon: '✅',
          description: 'Your order has been successfully delivered.',
          nextStep: 'Thank you for choosing Flower Fairies!'
        };
      case 'cancelled':
        return {
          color: 'bg-red-100 text-red-800',
          icon: '❌',
          description: 'This order has been cancelled.',
          nextStep: 'If you have any questions, please contact support.'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: '📋',
          description: 'Order status unknown.',
          nextStep: ''
        };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canCancelOrder = (status: string) => {
    return ['pending', 'processing'].includes(status);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">📋</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">The order you're looking for doesn't exist or you don't have access to it.</p>
          <Link
            to="/orders"
            className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(order.status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <Link to="/orders" className="text-gray-500 hover:text-gray-700">
                ← Back to Orders
              </Link>
            </li>
            <li>
              <span className="text-gray-500">•</span>
            </li>
            <li>
              <span className="text-gray-900 font-medium">Order #{order.id.slice(0, 8)}</span>
            </li>
          </ol>
        </nav>
      </div>

      {/* Order Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Order #{order.id.slice(0, 8)}
            </h1>
            <p className="text-gray-600">
              Placed on {formatDate(order.created_at)}
            </p>
            {order.driver && (
              <p className="text-gray-600 mt-1">
                Driver: {order.driver.user.name} ({order.driver.vehicle_type})
              </p>
            )}
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.icon} {order.status.toUpperCase()}
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(order.total)}
            </p>
          </div>
        </div>
      </div>

      {/* Order Status Timeline */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Order Status</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">{statusInfo.icon}</span>
            <div>
              <p className="font-medium text-blue-900">{statusInfo.description}</p>
              <p className="text-sm text-blue-700">{statusInfo.nextStep}</p>
            </div>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="space-y-4">
          <div className={`flex items-center ${order.status !== 'cancelled' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${order.status !== 'cancelled' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="font-medium">Order Placed</span>
            <span className="text-sm text-gray-500 ml-auto">{formatDate(order.created_at)}</span>
          </div>
          
          <div className={`flex items-center ${['processing', 'ready', 'delivering', 'delivered'].includes(order.status) ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${['processing', 'ready', 'delivering', 'delivered'].includes(order.status) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="font-medium">Processing</span>
          </div>
          
          <div className={`flex items-center ${['ready', 'delivering', 'delivered'].includes(order.status) ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${['ready', 'delivering', 'delivered'].includes(order.status) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="font-medium">Ready for Delivery</span>
          </div>
          
          <div className={`flex items-center ${['delivering', 'delivered'].includes(order.status) ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${['delivering', 'delivered'].includes(order.status) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="font-medium">Out for Delivery</span>
          </div>
          
          <div className={`flex items-center ${order.status === 'delivered' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-4 h-4 rounded-full mr-3 ${order.status === 'delivered' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="font-medium">Delivered</span>
            {order.status === 'delivered' && (
              <span className="text-sm text-gray-500 ml-auto">{formatDate(order.updated_at)}</span>
            )}
          </div>
        </div>

        {/* Live Tracking */}
        {order.status === 'delivering' && order.driver && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">🚚 Live Tracking</h3>
            <p className="text-blue-800 text-sm mb-3">
              Your order is being delivered by {order.driver.user.name}
            </p>
            <button
              onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(order.delivery_address)}`, '_blank')}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm"
            >
              📍 Track on Map
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Order Items</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                  <img
                    src={item.product.image_url || 'https://via.placeholder.com/80'}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.product.name}</h3>
                    <p className="text-sm text-gray-600">{item.variant.name}</p>
                    <p className="text-sm text-gray-500">
                      Quantity: {item.quantity} × {formatCurrency(item.price_at_time)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-lg">{formatCurrency(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary & Actions */}
        <div className="lg:col-span-1">
          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span>{order.delivery_fee === 0 ? 'FREE' : formatCurrency(order.delivery_fee)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Delivery Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Delivery Address</p>
                <p className="text-gray-900">{order.delivery_address}</p>
              </div>
              {order.delivery_instructions && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Special Instructions</p>
                  <p className="text-gray-900">{order.delivery_instructions}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700">Order Date</p>
                <p className="text-gray-900">{formatDate(order.created_at)}</p>
              </div>
              {order.status === 'delivered' && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Delivered Date</p>
                  <p className="text-gray-900">{formatDate(order.updated_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-3">
              {order.status === 'delivering' && (
                <button
                  onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(order.delivery_address)}`, '_blank')}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
                >
                  📍 Track Delivery
                </button>
              )}

              {canCancelOrder(order.status) && (
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelOrderMutation.isPending}
                  className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 disabled:opacity-50"
                >
                  {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
                </button>
              )}

              {order.status === 'delivered' && (
                <button
                  onClick={() => toast.success('Reorder feature coming soon!')}
                  className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
                >
                  Reorder Items
                </button>
              )}

              <Link
                to="/orders"
                className="block w-full bg-gray-500 text-white text-center py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Back to All Orders
              </Link>

              {order.status === 'delivered' && (
                <button
                  onClick={() => toast.success('Review feature coming soon!')}
                  className="w-full bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600"
                >
                  ⭐ Leave a Review
                </button>
              )}
            </div>
          </div>

          {/* Customer Support */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Need Help?</h2>
            <div className="space-y-3">
              <button
                onClick={() => window.open(`mailto:support@flowerfairies.com?subject=Order Support - ${order.id.slice(0, 8)}`, '_blank')}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
              >
                📧 Contact Support
              </button>
              <button
                onClick={() => toast.success('Live chat feature coming soon!')}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
              >
                💬 Live Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
