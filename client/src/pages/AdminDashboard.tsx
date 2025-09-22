import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSSE } from '../contexts/SSEContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface DashboardData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  recentOrders: any[];
  topProducts: any[];
  revenueOverTime: any[];
  activeDrivers: any[];
}

const AdminDashboard: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { subscribe } = useSSE();

  // Fetch dashboard analytics
  const { data: dashboardData, isLoading, error, refetch } = useQuery<DashboardData>({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const response = await api.get('/admin/analytics');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Subscribe to real-time updates
  React.useEffect(() => {
    const unsubscribe = subscribe('analytics:tick', () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
    });

    const unsubscribeOrderUpdate = subscribe('order:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      toast.success('Dashboard updated - new order activity');
    });

    const unsubscribeNewOrder = subscribe('order:new', () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'analytics'] });
      toast.success('New order received!');
    });

    return () => {
      unsubscribe();
      unsubscribeOrderUpdate();
      unsubscribeNewOrder();
    };
  }, [subscribe, queryClient]);

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/cache/clear');
    },
    onSuccess: () => {
      toast.success('Cache cleared successfully');
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast.error('Failed to clear cache');
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  };

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear all cache?')) {
      clearCacheMutation.mutate();
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load dashboard data</p>
          <button
            onClick={handleRefresh}
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🧚‍♀️ Admin Dashboard</h1>
            <p className="text-gray-600">Manage orders, analytics, and platform operations</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={handleClearCache}
              disabled={clearCacheMutation.isPending}
              className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-full">
              <span className="text-2xl">💰</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(dashboardData?.totalRevenue || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-full">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-blue-600">
                {dashboardData?.totalOrders || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="bg-purple-100 p-3 rounded-full">
              <span className="text-2xl">🚚</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Drivers</p>
              <p className="text-2xl font-bold text-purple-600">
                {dashboardData?.activeDrivers?.length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <div className="bg-orange-100 p-3 rounded-full">
              <span className="text-2xl">⏱️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-orange-600">
                {dashboardData?.ordersByStatus?.pending || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-semibold mb-4">Orders by Status</h3>
          <div className="space-y-3">
            {Object.entries(dashboardData?.ordersByStatus || {}).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="capitalize text-gray-700">{status}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  status === 'delivered' ? 'bg-green-100 text-green-800' :
                  status === 'delivering' ? 'bg-blue-100 text-blue-800' :
                  status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                  status === 'pending' ? 'bg-orange-100 text-orange-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-semibold mb-4">Top Products (30 days)</h3>
          <div className="space-y-3">
            {dashboardData?.topProducts?.slice(0, 5).map((product, index) => (
              <div key={product.productId} className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-500 w-6">#{index + 1}</span>
                  <span className="text-gray-700 ml-2">{product.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(product.revenue)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {product.quantity} sold
                  </div>
                </div>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-4">No sales data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders and Active Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Recent Orders</h3>
            <Link 
              to="/admin/orders"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {dashboardData?.recentOrders?.slice(0, 5).map((order: any) => (
              <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                <div>
                  <p className="font-medium text-gray-900">#{order.id.slice(0, 8)}</p>
                  <p className="text-sm text-gray-600">{order.customer_name}</p>
                  <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(parseFloat(order.total))}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'delivering' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-4">No recent orders</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-semibold mb-4">Active Drivers</h3>
          <div className="space-y-3">
            {dashboardData?.activeDrivers?.map((driver: any) => (
              <div key={driver.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                <div>
                  <p className="font-medium text-gray-900">{driver.name}</p>
                  <p className="text-sm text-gray-600">{driver.vehicle_type}</p>
                  <p className="text-xs text-gray-500">
                    {driver.active_deliveries} active deliveries
                  </p>
                </div>
                <div className="text-right">
                  <div className={`w-3 h-3 rounded-full ${
                    driver.available ? 'bg-green-500' : 'bg-red-500'
                  }`} title={driver.available ? 'Available' : 'Busy'} />
                  {driver.location_updated && (
                    <p className="text-xs text-gray-500 mt-1">
                      Updated: {formatDate(driver.location_updated)}
                    </p>
                  )}
                </div>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-4">No active drivers</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/admin/orders"
            className="flex items-center p-4 border border-gray-200 rounded-md hover:bg-gray-50 transition"
          >
            <span className="text-2xl mr-3">📋</span>
            <div>
              <p className="font-medium">Manage Orders</p>
              <p className="text-sm text-gray-600">View and update order status</p>
            </div>
          </Link>
          
          <Link
            to="/admin/users"
            className="flex items-center p-4 border border-gray-200 rounded-md hover:bg-gray-50 transition"
          >
            <span className="text-2xl mr-3">👥</span>
            <div>
              <p className="font-medium">User Management</p>
              <p className="text-sm text-gray-600">Manage customer accounts</p>
            </div>
          </Link>
          
          <Link
            to="/admin/inventory"
            className="flex items-center p-4 border border-gray-200 rounded-md hover:bg-gray-50 transition"
          >
            <span className="text-2xl mr-3">📦</span>
            <div>
              <p className="font-medium">Inventory</p>
              <p className="text-sm text-gray-600">Manage product stock</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;