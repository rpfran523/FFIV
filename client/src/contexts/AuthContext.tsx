import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, setTokens, clearTokens } from '../lib/api';
import { useCartStore } from '../lib/cart-store';
import type { User, LoginCredentials, RegisterData, AuthTokens } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const queryClient = useQueryClient();
  const { setCurrentUser, clearCart } = useCartStore();

  // Fetch current user
  const { data: user, isLoading, refetch: refreshUser } = useQuery<User | null>({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/auth/me');
        return data.user;
      } catch (error) {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: isInitialized,
  });

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await api.post<AuthTokens>('/auth/refresh', { refreshToken });
          setTokens(data);
        } catch (error) {
          clearTokens();
          clearCart();
          setCurrentUser('anonymous');
          localStorage.removeItem('current-user');
        }
      }
      setIsInitialized(true);
    };

    initAuth();
  }, [clearCart, setCurrentUser]);

  // Set current user for cart when user data changes
  useEffect(() => {
    if (user) {
      setCurrentUser(user.id);
      localStorage.setItem('current-user', JSON.stringify(user));
    } else {
      setCurrentUser('anonymous');
      localStorage.removeItem('current-user');
    }
  }, [user, setCurrentUser]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const { data } = await api.post<{ user: User; tokens: AuthTokens }>('/auth/login', credentials);
      return data;
    },
    onSuccess: (data) => {
      if (data.tokens) {
        setTokens(data.tokens);
      }
      queryClient.setQueryData(['auth', 'user'], data.user);
      
      // Set current user for cart isolation
      setCurrentUser(data.user.id);
      
      // Store user info for cart isolation
      localStorage.setItem('current-user', JSON.stringify(data.user));
      
      toast.success(`Welcome back, ${data.user.name}!`);
    },
    onError: (error: any) => {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Login failed');
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (registerData: RegisterData) => {
      const { data } = await api.post<{ user: User; tokens: AuthTokens }>('/auth/register', registerData);
      return data;
    },
    onSuccess: (data) => {
      if (data.tokens) {
        setTokens(data.tokens);
      }
      queryClient.setQueryData(['auth', 'user'], data.user);
      
      // Set current user for cart isolation
      setCurrentUser(data.user.id);
      
      // Store user info for cart isolation
      localStorage.setItem('current-user', JSON.stringify(data.user));
      
      toast.success('Account created! Please check your email for verification.');
    },
    onError: (error: any) => {
      console.error('Registration error details:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Registration failed';
      toast.error(errorMessage);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await api.post('/auth/logout');
      } catch (error) {
        // Ignore server errors during logout
        console.warn('Logout API call failed, continuing with local cleanup');
      }
    },
    onSettled: () => {
      // Always clear local state regardless of server response
      clearTokens();
      queryClient.setQueryData(['auth', 'user'], null);
      queryClient.clear();
      
      // Clear cart and user info
      clearCart();
      setCurrentUser('anonymous');
      localStorage.removeItem('current-user');
      localStorage.removeItem('refreshToken');
      
      // Force page reload to ensure clean state
      window.location.href = '/';
    },
  });

  const login = useCallback(async (credentials: LoginCredentials) => {
    await loginMutation.mutateAsync(credentials);
  }, [loginMutation]);

  const register = useCallback(async (data: RegisterData) => {
    await registerMutation.mutateAsync(data);
  }, [registerMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value: AuthContextType = {
    user: user || null,
    isLoading: !isInitialized || isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
