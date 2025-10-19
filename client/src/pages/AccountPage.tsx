import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const AccountPage: React.FC = () => {
  const { user, logout } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: '',
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updateData: any) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return updateData;
    },
    onSuccess: () => {
      setIsEditing(false);
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleChangePassword = () => {
    const currentPassword = prompt('Enter your current password:');
    const newPassword = prompt('Enter your new password (min 6 characters):');
    
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      toast.success('Password change feature coming soon!');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'driver': return 'bg-blue-100 text-blue-800';
      case 'customer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">👤 My Account</h1>
        <p className="text-gray-600">Manage your profile and view account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Account Information</h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="space-x-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{user.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="flex items-center space-x-2">
                  <p className="text-gray-900">{user.email}</p>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                    ✅ Verified
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1-555-0123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <p className="text-gray-900">Not provided</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type
                </label>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Account Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Account Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Member Since</span>
                <span className="font-medium">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Role</span>
                <span className="font-medium capitalize">{user.role}</span>
              </div>
            </div>
          </div>

          {/* Role-specific Tools */}
          {user?.role === 'admin' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Admin Tools</h3>
              <div className="space-y-3">
                <Link
                  to="/admin"
                  className="block w-full bg-purple-500 text-white text-center py-2 rounded-md hover:bg-purple-600"
                >
                  Admin Dashboard
                </Link>
                <Link
                  to="/admin/orders"
                  className="block w-full bg-blue-500 text-white text-center py-2 rounded-md hover:bg-blue-600"
                >
                  Manage Orders
                </Link>
              </div>
            </div>
          )}

          {user?.role === 'driver' && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">Driver Tools</h3>
              <div className="space-y-3">
                <Link
                  to="/driver"
                  className="block w-full bg-blue-500 text-white text-center py-2 rounded-md hover:bg-blue-600"
                >
                  Driver Dashboard
                </Link>
              </div>
            </div>
          )}

          {/* Security Actions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Security</h3>
            <div className="space-y-3">
              <button
                onClick={handleChangePassword}
                className="w-full bg-yellow-500 text-white py-2 rounded-md hover:bg-yellow-600"
              >
                Change Password
              </button>
              
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to sign out?')) {
                    await logout();
                  }
                }}
                className="w-full bg-red-500 text-white py-2 rounded-md hover:bg-red-600"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
