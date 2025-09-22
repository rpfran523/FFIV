import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { getAccessToken } from '../lib/api';

interface SSEContextType {
  subscribe: (eventType: string, handler: (data: any) => void) => () => void;
  isConnected: boolean;
}

const SSEContext = createContext<SSEContextType | undefined>(undefined);

export const useSSE = () => {
  const context = useContext(SSEContext);
  if (context === undefined) {
    throw new Error('useSSE must be used within an SSEProvider');
  }
  return context;
};

interface SSEProviderProps {
  children: React.ReactNode;
}

export const SSEProvider: React.FC<SSEProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const [isConnected, setIsConnected] = React.useState(false);

  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const { type, payload } = data;

      // Call registered handlers
      const handlers = handlersRef.current.get(type);
      if (handlers) {
        handlers.forEach(handler => handler(payload));
      }

      // Handle common event types
      switch (type) {
        case 'order:updated':
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          const user = queryClient.getQueryData<any>(['auth', 'user']);
          if (payload.userId === user?.id) {
            toast.success(`Order #${payload.orderId} status: ${payload.status}`);
          }
          break;

        case 'order:new':
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          toast.success('New order received!');
          break;

        case 'analytics:tick':
          queryClient.invalidateQueries({ queryKey: ['analytics'] });
          break;

        case 'driver:location':
          queryClient.setQueryData(['driver', 'location', payload.driverId], payload.location);
          break;
      }
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  }, [queryClient]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = getAccessToken();
    const url = new URL('/api/events', window.location.origin);
    if (token) {
      url.searchParams.append('token', token);
    }

    const eventSource = new EventSource(url.toString());

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('SSE connected');
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      console.error('SSE error:', error);
      
      // Retry connection after 5 seconds
      setTimeout(() => {
        if (isAuthenticated) {
          connect();
        }
      }, 5000);
    };

    eventSource.onmessage = handleSSEMessage;

    eventSourceRef.current = eventSource;
  }, [isAuthenticated, handleSSEMessage]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = handlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect]);

  const value: SSEContextType = {
    subscribe,
    isConnected,
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
};
