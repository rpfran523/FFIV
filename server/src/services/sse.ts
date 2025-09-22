import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SSEClient } from '../types';
import { optionalAuthenticate } from '../middleware/auth';

class SSEHub {
  private clients: Map<string, SSEClient> = new Map();
  private analyticsInterval: NodeJS.Timer | null = null;

  constructor() {
    // Start analytics ticker
    this.startAnalyticsTicker();
  }

  handleConnection = async (req: Request, res: Response) => {
    // Apply optional authentication
    await new Promise<void>((resolve, reject) => {
      optionalAuthenticate(req as any, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    // Create client
    const clientId = uuidv4();
    const client: SSEClient = {
      id: clientId,
      response: res,
      userId: (req as any).user?.id,
      role: (req as any).user?.role,
    };

    this.clients.set(clientId, client);
    console.log(`SSE client connected: ${clientId} (user: ${client.userId || 'anonymous'})`);

    // Send initial connection message
    this.sendToClient(client, {
      type: 'connected',
      payload: { clientId, timestamp: new Date().toISOString() },
    });

    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      res.write(':heartbeat\\n\\n');
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      this.clients.delete(clientId);
      console.log(`SSE client disconnected: ${clientId}`);
    });
  };

  private sendToClient(client: SSEClient, data: any) {
    try {
      client.response.write(`data: ${JSON.stringify(data)}\\n\\n`);
    } catch (error) {
      console.error(`Failed to send to client ${client.id}:`, error);
      this.clients.delete(client.id);
    }
  }

  // Broadcast to all connected clients
  broadcast(data: any) {
    this.clients.forEach((client) => {
      this.sendToClient(client, data);
    });
  }

  // Broadcast to clients with specific role
  broadcastToRole(role: string, data: any) {
    this.clients.forEach((client) => {
      if (client.role === role) {
        this.sendToClient(client, data);
      }
    });
  }

  // Broadcast to specific user
  broadcastToUser(userId: string, data: any) {
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        this.sendToClient(client, data);
      }
    });
  }

  // Order status update events
  notifyOrderUpdate(order: any) {
    // Notify the customer
    if (order.userId) {
      this.broadcastToUser(order.userId, {
        type: 'order:updated',
        payload: {
          orderId: order.id,
          status: order.status,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Notify admins
    this.broadcastToRole('admin', {
      type: 'order:updated',
      payload: {
        orderId: order.id,
        userId: order.userId,
        status: order.status,
        total: order.total,
        timestamp: new Date().toISOString(),
      },
    });

    // Notify assigned driver
    if (order.driverId) {
      this.broadcastToUser(order.driverId, {
        type: 'order:assigned',
        payload: {
          orderId: order.id,
          deliveryAddress: order.deliveryAddress,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // New order notification
  notifyNewOrder(order: any) {
    // Notify admins
    this.broadcastToRole('admin', {
      type: 'order:new',
      payload: {
        orderId: order.id,
        userId: order.userId,
        total: order.total,
        timestamp: new Date().toISOString(),
      },
    });

    // Notify available drivers
    this.broadcastToRole('driver', {
      type: 'order:available',
      payload: {
        orderId: order.id,
        deliveryAddress: order.deliveryAddress,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Driver location update
  notifyDriverLocation(driverId: string, location: { lat: number; lng: number }) {
    this.broadcast({
      type: 'driver:location',
      payload: {
        driverId,
        location,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Analytics ticker for admin dashboard
  private startAnalyticsTicker() {
    // Send analytics updates every 30 seconds
    this.analyticsInterval = setInterval(() => {
      this.broadcastToRole('admin', {
        type: 'analytics:tick',
        payload: {
          timestamp: new Date().toISOString(),
        },
      });
    }, 30000);
  }

  // Cleanup
  shutdown() {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    
    // Close all connections
    this.clients.forEach((client) => {
      client.response.end();
    });
    
    this.clients.clear();
  }
}

export const sseHub = new SSEHub();
