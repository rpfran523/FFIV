export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'customer' | 'admin' | 'driver';
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
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

export interface ProductVariant {
  id: string;
  productId?: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, any>;
}

export interface CartItem {
  variantId: string;
  variant: ProductVariant;
  product: Product;
  quantity: number;
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
  driverId?: string;
  driver?: Driver;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  variant: ProductVariant;
  product: Product;
  quantity: number;
  priceAtTime: number;
  total: number;
}

export interface Driver {
  id: string;
  userId: string;
  user: User;
  vehicleType: string;
  licensePlate: string;
  available: boolean;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface PaymentIntent {
  clientSecret: string;
  amount: number;
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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
}
