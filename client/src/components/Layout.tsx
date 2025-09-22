import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCartStore } from '../lib/cart-store';
import { useSSE } from '../contexts/SSEContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { getTotalItems } = useCartStore();
  const { isConnected } = useSSE();
  const navigate = useNavigate();
  const location = useLocation();
  
  const cartItemsCount = getTotalItems();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
            <Link to={isAuthenticated ? "/home" : "/"} className="flex items-center">
              <span className="text-2xl font-bold text-fairy-pink">🧚‍♀️ Flower Fairies</span>
            </Link>
              
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                {isAuthenticated && (
                  <Link
                    to="/products"
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                      location.pathname.startsWith('/products')
                        ? 'text-primary-600 border-b-2 border-primary-600'
                        : 'text-gray-700 hover:text-primary-600'
                    }`}
                  >
                    Products
                  </Link>
                )}
                
                {isAuthenticated && user?.role === 'customer' && (
                  <Link
                    to="/orders"
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                      location.pathname.startsWith('/orders')
                        ? 'text-primary-600 border-b-2 border-primary-600'
                        : 'text-gray-700 hover:text-primary-600'
                    }`}
                  >
                    My Orders
                  </Link>
                )}
                
                {isAuthenticated && user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                      location.pathname.startsWith('/admin')
                        ? 'text-primary-600 border-b-2 border-primary-600'
                        : 'text-gray-700 hover:text-primary-600'
                    }`}
                  >
                    Admin Dashboard
                  </Link>
                )}
                
                {isAuthenticated && user?.role === 'driver' && (
                  <Link
                    to="/driver"
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                      location.pathname.startsWith('/driver')
                        ? 'text-primary-600 border-b-2 border-primary-600'
                        : 'text-gray-700 hover:text-primary-600'
                    }`}
                  >
                    Driver Dashboard
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* SSE Connection Status */}
              {isAuthenticated && (
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? 'Live updates connected' : 'Live updates disconnected'} />
              )}
              
              {/* Cart Icon - Only for customers */}
              {user?.role === 'customer' && (
                <Link to="/checkout" className="relative p-2 text-gray-700 hover:text-primary-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {cartItemsCount}
                    </span>
                  )}
                </Link>
              )}
              
              {/* Show cart for non-authenticated users */}
              {!isAuthenticated && (
                <Link to="/auth" className="relative p-2 text-gray-700 hover:text-primary-600" title="Sign in to use cart">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </Link>
              )}

              {/* User Menu */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-3">
                  <Link to="/account" className="text-gray-700 hover:text-primary-600">
                    <span className="text-sm font-medium">{user?.name}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-primary-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-600"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <p className="text-sm">© 2024 Flower Fairies. All rights reserved.</p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
