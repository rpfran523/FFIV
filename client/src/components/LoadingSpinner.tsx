import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-fairy-lavender rounded-full animate-spin border-t-fairy-pink"></div>
        <div className="absolute top-2 left-2 w-12 h-12 border-4 border-fairy-purple rounded-full animate-spin animation-delay-150 border-t-primary-500"></div>
        <div className="absolute top-4 left-4 w-8 h-8 border-4 border-primary-300 rounded-full animate-spin animation-delay-300 border-t-fairy-pink"></div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
