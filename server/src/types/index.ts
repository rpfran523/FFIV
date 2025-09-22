import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin' | 'driver';
  emailVerified: boolean;
  emailVerificationToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  basePrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, any>;
}

export interface Order {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  deliveryInstructions?: string;
  paymentIntentId?: string;
  driverId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  priceAtTime: number;
  total: number;
}

export interface Driver {
  id: string;
  userId: string;
  vehicleType: string;
  licensePlate: string;
  available: boolean;
}

export interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  updatedAt: Date;
}

export interface Analytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  recentOrders: Order[];
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface SSEClient {
  id: string;
  response: any;
  userId?: string;
  role?: string;
}

export interface CacheAdapter {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  isConnected(): boolean;
}
