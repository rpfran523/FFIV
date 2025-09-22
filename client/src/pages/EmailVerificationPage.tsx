import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';

const EmailVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const { data, isLoading, error } = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      if (!token) throw new Error('No verification token provided');
      const response = await api.get(`/auth/verify-email?token=${token}`);
      return response.data;
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setVerificationStatus('success');
    } else if (error) {
      setVerificationStatus('error');
    }
  }, [data, error]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <span className="text-6xl mb-4 block">❌</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Verification Link</h2>
          <p className="text-gray-600 mb-6">This verification link is invalid or malformed.</p>
          <Link
            to="/auth"
            className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-gray-600 mt-4">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <span className="text-6xl mb-4 block">✅</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your email has been verified. You can now sign in to your account.
          </p>
          <div className="space-x-4">
            <Link
              to="/auth"
              className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
            >
              Sign In
            </Link>
            <Link
              to="/products"
              className="bg-gray-200 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-300 font-medium"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <span className="text-6xl mb-4 block">❌</span>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
        <p className="text-gray-600 mb-6">
          This verification link is invalid or has expired.
        </p>
        <div className="space-x-4">
          <Link
            to="/auth"
            className="bg-primary-500 text-white px-6 py-3 rounded-md hover:bg-primary-600 font-medium"
          >
            Sign In
          </Link>
          <button
            onClick={() => {
              const email = prompt('Enter your email to resend verification:');
              if (email) {
                api.post('/auth/resend-verification', { email })
                  .then(() => alert('Verification email sent!'))
                  .catch(() => alert('Failed to send verification email'));
              }
            }}
            className="bg-gray-200 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-300 font-medium"
          >
            Resend Verification
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;
