import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSSE } from '../contexts/SSEContext';
import { useCartStore } from '../lib/cart-store';
import LoadingSpinner from '../components/LoadingSpinner';

interface Order {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  deliveryInstructions?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  driver?: {
    id: string;
    vehicleType: string;
    user: {
      name: string;
    };
  };
}

interface OrderItem {
  id: string;
  variantId: string;
  quantity: number;
  priceAtTime: number;
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
    imageUrl: string;
  };
}

const OrdersPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const queryClient = useQueryClient();
  const { subscribe } = useSSE();
  const { addItem } = useCartStore();
  const navigate = useNavigate();

  // Fetch orders
  const { data: orders, isLoading, error } = useQuery<Order[]>({
    queryKey: ['orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await api.get(`/orders?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post(`/orders/${orderId}/cancel`);
    },
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (data.status === 'delivered') {
        toast.success(`Order #${data.orderId.slice(0, 8)} has been delivered!`);
      } else if (data.status === 'delivering') {
        toast.success(`Order #${data.orderId.slice(0, 8)} is out for delivery!`);
      }
    });

    return unsubscribe;
  }, [subscribe, queryClient]);

  const handleCancelOrder = (orderId: string) => {
    if (confirm('Are you sure you want to cancel this order?')) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  const handleReorder = (order: Order) => {
    try {
      // Add all items from the order to cart
      order.items.forEach((item) => {
        const productForCart = {
          id: item.product.id,
          name: item.product.name,
          description: '',
          category: 'Bouquets',
          imageUrl: item.product.imageUrl,
          basePrice: item.priceAtTime,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [],
        };

        addItem(
          {
            id: item.variantId,
            name: item.variant.name,
            price: item.priceAtTime,
            stock: 999, // We don't have real-time stock here
            sku: item.variant.sku,
            attributes: item.variant.attributes,
          },
          productForCart,
          item.quantity
        );
      });
      
      toast.success('Items added to cart!');
      navigate('/checkout');
    } catch (error) {
      toast.error('Failed to reorder. Please try adding items manually.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-purple-100 text-purple-800';
      case 'delivering':
        return 'bg-indigo-100 text-indigo-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'ready':
        return '📦';
      case 'delivering':
        return '🚚';
      case 'delivered':
        return '✅';
      case 'cancelled':
        return '❌';
      default:
        return '📋';
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
      month: 'short',
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load orders</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 My Orders</h1>
            <p className="text-gray-600">Track your flower delivery orders</p>
          </div>
          <Link
            to="/products"
            className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600"
          >
            Continue Shopping
          </Link>
        </div>
      </div>

      {/* Status Filter */}
      <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              statusFilter === '' 
                ? 'bg-primary-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Orders
          </button>
          {['pending', 'processing', 'ready', 'delivering', 'delivered', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${
                statusFilter === status 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getStatusIcon(status)} {status}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {orders && orders.length > 0 ? (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Order Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #{order.id.slice(0, 8)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Placed on {formatDate(order.createdAt)}
                    </p>
                    {order.driver && (
                      <p className="text-sm text-gray-600">
                        Driver: {order.driver.user.name} ({order.driver.vehicleType})
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)} {order.status}
                    </span>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="p-6">
                <h4 className="font-medium text-gray-900 mb-3">Items Ordered</h4>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4">
                      <img
                        src={item.product.imageUrl || 'https://via.placeholder.com/60'}
                        alt={item.product.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">{item.product.name}</h5>
                        <p className="text-sm text-gray-600">{item.variant.name}</p>
                        <p className="text-sm text-gray-500">
                          Quantity: {item.quantity} × {formatCurrency(item.priceAtTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Information */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h5 className="font-medium text-gray-900 mb-2">Delivery Information</h5>
                  <p className="text-gray-700">{order.deliveryAddress}</p>
                  {order.deliveryInstructions && (
                    <p className="text-sm text-gray-600 mt-1">
                      Instructions: {order.deliveryInstructions}
                    </p>
                  )}
                </div>

                {/* Order Actions */}
                <div className="mt-6 flex justify-between items-center">
                  <Link
                    to={`/orders/${order.id}`}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    View Details →
                  </Link>
                  
                  <div className="flex space-x-3">
                    {order.status === 'delivering' && (
                      <button
                        onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(order.deliveryAddress)}`, '_blank')}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-sm"
                      >
                        📍 Track Delivery
                      </button>
                    )}
                    
                    {canCancelOrder(order.status) && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancelOrderMutation.isPending}
                        className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 disabled:opacity-50 text-sm"
                      >
                        {cancelOrderMutation.isPending ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    )}
                    
                    {order.status === 'delivered' && (
                      <button
                        onClick={() => handleReorder(order)}
                        className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 text-sm"
                      >
                        🔄 Reorder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <span className="text-6xl mb-4 block">🛒</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
          <p className="text-gray-600 mb-6">
            {statusFilter 
              ? `No ${statusFilter} orders found. Try a different filter.`
              : "You haven't placed any orders yet. Start shopping to see your orders here!"
            }
          </p>
          <div className="space-x-4">
            <Link
              to="/products"
              className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
            >
              Start Shopping
            </Link>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter('')}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-300 font-medium"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
