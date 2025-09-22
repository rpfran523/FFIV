import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useSSE } from '../contexts/SSEContext';
import LoadingSpinner from '../components/LoadingSpinner';
import PhotoCapture from '../components/PhotoCapture';

interface DriverProfile {
  id: string;
  name: string;
  email: string;
  vehicle_type: string;
  license_plate: string;
  available: boolean;
  lat?: number;
  lng?: number;
  location_updated?: string;
  active_deliveries: number;
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  delivery_address: string;
  total: string;
  status: string;
  created_at: string;
  items: any[];
  item_count?: number;
  distance_miles?: number;
}

const DriverDashboard: React.FC = () => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const queryClient = useQueryClient();
  const { subscribe } = useSSE();

  // Fetch driver profile
  const { data: profile, isLoading: profileLoading } = useQuery<DriverProfile>({
    queryKey: ['driver', 'profile'],
    queryFn: async () => {
      const response = await api.get('/driver/profile');
      return response.data;
    },
    refetchInterval: 30000,
  });

  // Fetch available orders
  const { data: availableOrders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['driver', 'orders', 'available'],
    queryFn: async () => {
      const response = await api.get('/driver/orders/available');
      return response.data;
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch active deliveries
  const { data: activeDeliveries } = useQuery<Order[]>({
    queryKey: ['driver', 'orders', 'active'],
    queryFn: async () => {
      const response = await api.get('/driver/orders/active');
      return response.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });


  // Toggle availability mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (available: boolean) => {
      await api.patch('/driver/availability', { available });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'profile'] });
      toast.success('Availability updated');
    },
    onError: () => {
      toast.error('Failed to update availability');
    },
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async (coords: { lat: number; lng: number }) => {
      await api.post('/driver/location', coords);
    },
    onSuccess: () => {
      toast.success('Location updated');
    },
    onError: () => {
      toast.error('Failed to update location');
    },
  });

  // Accept order mutation
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await api.post(`/driver/orders/${orderId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'orders'] });
      toast.success('Order accepted!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to accept order');
    },
  });

  // Complete delivery mutation
  const completeDeliveryMutation = useMutation({
    mutationFn: async ({ orderId, deliveryNotes, deliveryPhotoBase64 }: { 
      orderId: string; 
      deliveryNotes?: string; 
      deliveryPhotoBase64?: string; 
    }) => {
      await api.post(`/driver/orders/${orderId}/complete`, {
        deliveryNotes,
        deliveryPhotoBase64,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'orders'] });
      setCompletingOrderId(null);
      setDeliveryNotes('');
      toast.success('Delivery completed with photo!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to complete delivery');
    },
  });

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(coords);
          setLocationError(null);
        },
        (error) => {
          setLocationError('Location access denied');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setLocationError('Geolocation not supported');
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeOrderUpdate = subscribe('order:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'orders'] });
    });

    const unsubscribeNewOrder = subscribe('order:available', () => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'orders', 'available'] });
      toast.success('New delivery available!');
    });

    const unsubscribeAssigned = subscribe('order:assigned', (data) => {
      queryClient.invalidateQueries({ queryKey: ['driver', 'orders'] });
      toast.success(`New delivery assigned: ${data.deliveryAddress}`);
    });

    return () => {
      unsubscribeOrderUpdate();
      unsubscribeNewOrder();
      unsubscribeAssigned();
    };
  }, [subscribe, queryClient]);

  const handleToggleAvailability = () => {
    if (profile) {
      toggleAvailabilityMutation.mutate(!profile.available);
    }
  };

  const handleUpdateLocation = () => {
    if (location) {
      updateLocationMutation.mutate(location);
    } else {
      toast.error('Location not available');
    }
  };

  const handleAcceptOrder = (orderId: string) => {
    acceptOrderMutation.mutate(orderId);
  };

  const handleCompleteDelivery = (orderId: string) => {
    setCompletingOrderId(orderId);
    setDeliveryNotes('');
    setShowPhotoCapture(true);
  };

  const handlePhotoCapture = (photoBase64: string) => {
    if (completingOrderId) {
      completeDeliveryMutation.mutate({
        orderId: completingOrderId,
        deliveryNotes,
        deliveryPhotoBase64: photoBase64,
      });
    }
    setShowPhotoCapture(false);
  };

  const handlePhotoCaptureCancel = () => {
    setShowPhotoCapture(false);
    
    // Allow completion without photo
    if (completingOrderId && confirm('Complete delivery without photo?')) {
      completeDeliveryMutation.mutate({
        orderId: completingOrderId,
        deliveryNotes,
      });
    } else {
      setCompletingOrderId(null);
      setDeliveryNotes('');
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (profileLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🚚 Driver Dashboard</h1>
        <p className="text-gray-600">Manage deliveries and track your earnings</p>
      </div>

      {/* Driver Status Card */}
      <div className="bg-white rounded-lg p-6 shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Driver Status</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleUpdateLocation}
              disabled={!location || updateLocationMutation.isPending}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
            >
              {updateLocationMutation.isPending ? 'Updating...' : 'Update Location'}
            </button>
            <button
              onClick={handleToggleAvailability}
              disabled={toggleAvailabilityMutation.isPending}
              className={`px-4 py-2 rounded-md font-medium ${
                profile?.available
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              } disabled:opacity-50`}
            >
              {toggleAvailabilityMutation.isPending
                ? 'Updating...'
                : profile?.available
                ? 'Go Offline'
                : 'Go Online'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">{profile?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Vehicle</p>
            <p className="font-medium">{profile?.vehicle_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">License Plate</p>
            <p className="font-medium">{profile?.license_plate}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${
              profile?.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                profile?.available ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {profile?.available ? 'Available' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Location Status */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Location Status</p>
              <p className="font-medium">
                {location ? '📍 Location Available' : '❌ Location Not Available'}
              </p>
              {locationError && (
                <p className="text-red-500 text-sm">{locationError}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Active Deliveries</p>
              <p className="text-2xl font-bold text-blue-600">
                {profile?.active_deliveries || 0}
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Active Deliveries */}
      {activeDeliveries && activeDeliveries.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">🚚 Active Deliveries</h2>
          <div className="space-y-4">
            {activeDeliveries.map((order) => (
              <div key={order.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">Order #{order.id.slice(0, 8)}</h3>
                    <p className="text-gray-600">{order.customer_name}</p>
                    <p className="text-sm text-gray-500">{order.delivery_address}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      {order.status}
                    </span>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Items:</p>
                  <div className="text-sm text-gray-600">
                    {order.items?.map((item, index) => (
                      <span key={index}>
                        {item.quantity}x {item.product} ({item.variant})
                        {index < order.items.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(order.delivery_address)}`, '_blank')}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 text-sm"
                  >
                    📍 Open in Maps
                  </button>
                  <button
                    onClick={() => handleCompleteDelivery(order.id)}
                    disabled={completeDeliveryMutation.isPending}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 text-sm"
                  >
                    {completeDeliveryMutation.isPending ? 'Completing...' : '📸 Complete with Photo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Orders */}
      <div className="bg-white rounded-lg p-6 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">📦 Available Orders</h2>
          <span className="text-sm text-gray-600">
            {availableOrders?.length || 0} orders available
          </span>
        </div>

        {ordersLoading ? (
          <div className="text-center py-8">
            <LoadingSpinner />
          </div>
        ) : availableOrders && availableOrders.length > 0 ? (
          <div className="space-y-4">
            {availableOrders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">Order #{order.id.slice(0, 8)}</h3>
                    <p className="text-gray-600">{order.customer_name}</p>
                    <p className="text-sm text-gray-500">{order.delivery_address}</p>
                    <p className="text-xs text-gray-400">
                      Ordered: {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                    <p className="text-sm text-gray-500">{order.item_count} items</p>
                    {order.distance_miles && (
                      <p className="text-xs text-gray-400">
                        ~{Math.round(order.distance_miles)} miles
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(order.delivery_address)}`, '_blank')}
                    className="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 text-sm"
                  >
                    📍 View Location
                  </button>
                  <button
                    onClick={() => handleAcceptOrder(order.id)}
                    disabled={acceptOrderMutation.isPending || !profile?.available}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
                  >
                    {acceptOrderMutation.isPending ? 'Accepting...' : 'Accept Order'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">📭</span>
            <p className="text-gray-500 mb-4">No orders available right now</p>
            <p className="text-sm text-gray-400">
              {profile?.available 
                ? 'Check back soon for new delivery opportunities!' 
                : 'Go online to see available orders'}
            </p>
          </div>
        )}
      </div>


      {/* Photo Capture Modal */}
      <PhotoCapture
        isOpen={showPhotoCapture}
        onPhotoCapture={handlePhotoCapture}
        onCancel={handlePhotoCaptureCancel}
      />

      {/* Delivery Notes Modal */}
      {completingOrderId && showPhotoCapture && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">📝 Delivery Notes (Optional)</h3>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Add any delivery notes (e.g., 'Left at front door', 'Customer not home')..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
            <p className="text-sm text-gray-600 mt-2">
              Next: Take a photo to complete the delivery
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
