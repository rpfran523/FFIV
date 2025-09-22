import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';

interface InventoryProduct {
  id: string;
  name: string;
  category: string;
  active: boolean;
  variant_count: number;
  total_stock: number;
  min_stock: number;
  variants: InventoryVariant[];
}

interface InventoryVariant {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
}

const AdminInventoryPage: React.FC = () => {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  // Fetch inventory
  const { data: inventory, isLoading, error } = useQuery<InventoryProduct[]>({
    queryKey: ['admin', 'inventory'],
    queryFn: async () => {
      const response = await api.get('/admin/products/inventory');
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Update stock mutation
  const updateStockMutation = useMutation({
    mutationFn: async ({ variantId, newStock }: { variantId: string; newStock: number }) => {
      await api.patch(`/admin/variants/${variantId}/stock`, { stock: newStock });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      toast.success('Stock updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update stock');
    },
  });

  // Update product status mutation
  const updateProductStatusMutation = useMutation({
    mutationFn: async ({ productId, active }: { productId: string; active: boolean }) => {
      await api.patch(`/admin/products/${productId}/status`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      toast.success('Product status updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update product status');
    },
  });

  const filteredInventory = inventory?.filter(product => {
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.variants.some(v => v.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStock = !stockFilter || 
      (stockFilter === 'low' && product.min_stock < 10) ||
      (stockFilter === 'out' && product.min_stock === 0) ||
      (stockFilter === 'in' && product.min_stock > 0);

    return matchesCategory && matchesSearch && matchesStock;
  });

  const categories = [...new Set(inventory?.map(p => p.category) || [])];

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800';
    if (stock < 10) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStockStatusText = (stock: number) => {
    if (stock === 0) return 'Out of Stock';
    if (stock < 10) return 'Low Stock';
    return 'In Stock';
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Failed to load inventory</p>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📦 Inventory Management</h1>
            <p className="text-gray-600">Manage product stock levels and variants</p>
          </div>
          <Link
            to="/admin"
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg p-4 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search products or SKUs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Stock Levels</option>
            <option value="in">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Inventory Overview */}
      {inventory && inventory.length > 0 && (
        <div className="bg-white rounded-lg p-6 shadow-md mb-6">
          <h3 className="text-lg font-semibold mb-4">Inventory Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{inventory.length}</p>
              <p className="text-sm text-gray-600">Total Products</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {inventory.reduce((sum, product) => sum + product.variant_count, 0)}
              </p>
              <p className="text-sm text-gray-600">Total Variants</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {inventory.filter(product => product.min_stock < 10 && product.min_stock > 0).length}
              </p>
              <p className="text-sm text-gray-600">Low Stock Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {inventory.filter(product => product.min_stock === 0).length}
              </p>
              <p className="text-sm text-gray-600">Out of Stock</p>
            </div>
          </div>
        </div>
      )}

      {/* Products List */}
      {filteredInventory && filteredInventory.length > 0 ? (
        <div className="space-y-6">
          {filteredInventory.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600">{product.category}</p>
                    <div className="flex items-center mt-2">
                      <button
                        onClick={() => updateProductStatusMutation.mutate({ productId: product.id, active: !product.active })}
                        disabled={updateProductStatusMutation.isPending}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 disabled:opacity-50 ${
                          product.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.active ? 'Active' : 'Inactive'}
                      </button>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(product.min_stock)}`}>
                        {getStockStatusText(product.min_stock)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total Stock</p>
                    <p className="text-2xl font-bold text-gray-900">{product.total_stock}</p>
                  </div>
                </div>

                {/* Variants */}
                <div className="mt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Variants</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {product.variants.map((variant) => (
                      <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h5 className="font-medium text-gray-900">{variant.name}</h5>
                            <p className="text-sm text-gray-600">SKU: {variant.sku}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStockStatusColor(variant.stock)}`}>
                            {variant.stock}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900">
                            ${variant.price}
                          </span>
                          <button
                            onClick={() => {
                              const newStock = prompt(`Update stock for ${variant.name}:`, variant.stock.toString());
                              if (newStock && !isNaN(parseInt(newStock))) {
                                updateStockMutation.mutate({ variantId: variant.id, newStock: parseInt(newStock) });
                              }
                            }}
                            disabled={updateStockMutation.isPending}
                            className="text-primary-600 hover:text-primary-900 text-sm disabled:opacity-50"
                          >
                            {updateStockMutation.isPending ? 'Updating...' : 'Edit Stock'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <span className="text-6xl mb-4 block">📦</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Found</h3>
          <p className="text-gray-600">
            {categoryFilter || searchTerm || stockFilter
              ? 'No products match your current filters.'
              : 'No products in inventory.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminInventoryPage;
