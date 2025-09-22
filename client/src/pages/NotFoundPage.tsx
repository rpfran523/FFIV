import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="mb-8">
          <span className="text-9xl">🧚‍♀️</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Oops! Page Not Found
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-md mx-auto">
          The fairy you're looking for seems to have flown away. Let's get you back to the garden!
        </p>
        <div className="space-x-4">
          <Link
            to="/"
            className="inline-block bg-primary-500 text-white px-6 py-3 rounded-md font-semibold hover:bg-primary-600 transition"
          >
            Go Home
          </Link>
          <Link
            to="/products"
            className="inline-block bg-gray-200 text-gray-700 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition"
          >
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
