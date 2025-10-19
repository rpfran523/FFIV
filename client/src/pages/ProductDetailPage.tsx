import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useCartStore } from '../lib/cart-store';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  basePrice: number;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
}

interface ProductVariant {
  id: string;
  productId?: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, any>;
}

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { addItem } = useCartStore();
  
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Fetch product details
  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await api.get(`/products/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Set default variant when product loads
  React.useEffect(() => {
    if (product?.variants && product.variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(product.variants[0].id);
    }
  }, [product, selectedVariantId]);

  const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);

  const handleAddToCart = async () => {
    if (!selectedVariant || !product) {
      toast.error('Please select a variant');
      return;
    }

    if (selectedVariant.stock < quantity) {
      toast.error('Not enough stock available');
      return;
    }

    setIsAddingToCart(true);
    
    try {
      addItem(selectedVariant, product, quantity);
      toast.success(`Added ${quantity}x ${product.name} to cart!`);
      
      // Optional: Navigate to cart or stay on page
      // navigate('/checkout');
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setTimeout(() => {
      navigate('/checkout');
    }, 500);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: 'Out of Stock', color: 'text-red-600' };
    if (stock < 10) return { text: `Only ${stock} left`, color: 'text-orange-600' };
    return { text: 'In Stock', color: 'text-green-600' };
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🌸</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">The flower you're looking for seems to have bloomed away.</p>
          <Link
            to="/products"
            className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
          >
            Browse All Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="mb-6">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <Link to="/products" className="text-gray-500 hover:text-gray-700">
                ← Back to Products
              </Link>
            </li>
            <li>
              <span className="text-gray-500">•</span>
            </li>
            <li>
              <span className="text-gray-900 font-medium">{product.name}</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product Image */}
        <div className="space-y-4">
          <div className="w-full">
            <img
              src={product.imageUrl || 'https://via.placeholder.com/600'}
              alt={product.name}
              className="w-full object-contain rounded-lg shadow-lg"
            />
          </div>
          
          {/* Category Badge */}
          <div className="flex justify-center">
            <span className="bg-primary-100 text-primary-800 px-4 py-2 rounded-full text-sm font-medium">
              {product.category}
            </span>
          </div>
        </div>

        {/* Product Information */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center">
                <span className="text-yellow-400">★★★★★</span>
                <span className="text-sm text-gray-600 ml-2">0.0 (0 reviews)</span>
              </div>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed">{product.description}</p>
          </div>

          {/* Variant Selection */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Choose Size:</h3>
              <div className="space-y-3">
                {product.variants.map((variant) => (
                  <label
                    key={variant.id}
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition ${
                      selectedVariantId === variant.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${variant.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={variant.id}
                      checked={selectedVariantId === variant.id}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      disabled={variant.stock === 0}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">{variant.name}</span>
                        <span className="text-lg font-bold text-primary-600">
                          {formatCurrency(variant.price)}
                        </span>
                      </div>
                      <div className="flex justify-end items-center mt-1">
                        <span className={`text-sm font-medium ${getStockStatus(variant.stock).color}`}>
                          {getStockStatus(variant.stock).text}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          {selectedVariant && selectedVariant.stock > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Quantity:</h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  -
                </button>
                <span className="text-xl font-medium w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(selectedVariant.stock, quantity + 1))}
                  className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  +
                </button>
                <span className="text-sm text-gray-600 ml-4">
                  Max: {selectedVariant.stock}
                </span>
              </div>
            </div>
          )}

          {/* Price Display */}
          {selectedVariant && (
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-900">Total Price:</span>
                <span className="text-2xl font-bold text-primary-600">
                  {formatCurrency(selectedVariant.price * quantity)}
                </span>
              </div>
              {quantity > 1 && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatCurrency(selectedVariant.price)} × {quantity}
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            {selectedVariant && selectedVariant.stock > 0 ? (
              <>
                {(!isAuthenticated || user?.role === 'customer') && (
                  <>
                    <button
                      onClick={handleAddToCart}
                      disabled={isAddingToCart}
                      className="w-full bg-primary-500 text-white py-3 px-6 rounded-md hover:bg-primary-600 disabled:opacity-50 font-medium text-lg"
                    >
                      {isAddingToCart ? 'Adding...' : `Add to Cart - ${formatCurrency(selectedVariant.price * quantity)}`}
                    </button>
                    
                    {isAuthenticated && (
                      <button
                        onClick={handleBuyNow}
                        disabled={isAddingToCart}
                        className="w-full bg-green-500 text-white py-3 px-6 rounded-md hover:bg-green-600 disabled:opacity-50 font-medium text-lg"
                      >
                        Buy Now
                      </button>
                    )}
                  </>
                )}
                
                {!isAuthenticated && (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">Sign in to purchase this item</p>
                    <Link
                      to="/auth"
                      className="inline-block bg-blue-500 text-white py-2 px-6 rounded-md hover:bg-blue-600 font-medium"
                    >
                      Sign In to Buy
                    </Link>
                  </div>
                )}
                
                {user?.role === 'admin' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-purple-800 font-medium">Admin View</p>
                    <p className="text-sm text-purple-600">
                      Stock: {selectedVariant.stock} • SKU: {selectedVariant.sku}
                    </p>
                  </div>
                )}
                
                {user?.role === 'driver' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 font-medium">Driver View</p>
                    <p className="text-sm text-blue-600">
                      This product may appear in delivery orders
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <span className="text-4xl mb-2 block">😔</span>
                <h3 className="text-lg font-medium text-red-800 mb-2">Out of Stock</h3>
                <p className="text-red-600">This item is currently unavailable</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
