import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';
import jwt from 'jsonwebtoken';
import config from './config/environment';

// Extend the Request interface to include our custom properties
declare module 'http' {
  interface IncomingMessage {
    userId?: string;
    userRole?: string;
  }
}

// Define message types
export type WSMessageType = 
  | 'activity_created'
  | 'lead_created'
  | 'lead_updated'
  | 'lead_status_changed'
  | 'call_created'
  | 'call_scheduled'
  | 'call_updated'
  | 'call_started'
  | 'call_ended'
  | 'team_member_online'
  | 'team_member_offline'
  | 'dashboard_update'
  | 'notification'
  | 'auth'
  | 'ping'
  | 'pong'
  | 'error'
  | 'join_room'
  | 'leave_room';

export interface WSMessage {
  type: WSMessageType;
  data: any;
  timestamp?: number;
  userId?: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userRole?: string;
  isAlive?: boolean;
  lastPing?: number;
}

// Active client connections with enhanced metadata
const clients: Map<string, AuthenticatedWebSocket> = new Map();

// Room management for targeted broadcasting
const rooms: Map<string, Set<string>> = new Map();

// JWT secret for WebSocket authentication sourced from centralized config
const JWT_SECRET = config.jwt.secret;

export function setupWebsocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info, cb) => {
      // Enhanced verification with JWT token
      const token = info.req.headers['sec-websocket-protocol'];
      
      if (token && token.startsWith('Bearer ')) {
        try {
          const jwtToken = token.substring(7);
          const decoded = jwt.verify(jwtToken, JWT_SECRET) as any;
          info.req.userId = decoded.userId;
          info.req.userRole = decoded.role;
          cb(true);
        } catch (error) {
          console.error('WebSocket JWT verification failed:', error);
          cb(false, 401, 'Unauthorized');
        }
      } else {
        // Allow connection without JWT for initial auth handshake
        cb(true);
      }
    }
  });
  
  // Setup heartbeat mechanism
  const heartbeatInterval = setInterval(() => {
    clients.forEach((client, userId) => {
      if (client.isAlive === false) {
        console.log(`Terminating inactive connection for user ${userId}`);
        client.terminate();
        clients.delete(userId);
        broadcastUserStatus(userId);
      } else {
        client.isAlive = false;
        client.ping();
        client.lastPing = Date.now();
      }
    });
  }, 30000); // 30 seconds
  
  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    console.log('New WebSocket connection established');
    
    // Initialize connection state
    ws.isAlive = true;
    ws.lastPing = Date.now();
    
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString()) as WSMessage;
        
        // Add timestamp if not present
        if (!parsedMessage.timestamp) {
          parsedMessage.timestamp = Date.now();
        }
        
        await handleWebSocketMessage(ws, parsedMessage);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        sendError(ws, 'Invalid message format');
      }
    });
    
    ws.on('close', () => {
      if (ws.userId) {
        console.log(`User ${ws.userId} disconnected from WebSocket`);
        clients.delete(ws.userId);
        leaveAllRooms(ws.userId);
        broadcastUserStatus(ws.userId);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (ws.userId) {
        clients.delete(ws.userId);
        leaveAllRooms(ws.userId);
        broadcastUserStatus(ws.userId);
      }
    });
  });
  
  // Clean up on server shutdown
  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  return wss;
}

async function handleWebSocketMessage(ws: AuthenticatedWebSocket, message: WSMessage) {
  switch (message.type) {
    case 'auth':
      await handleAuthentication(ws, message);
      break;
      
    case 'ping':
      sendMessage(ws, { type: 'pong', data: { timestamp: Date.now() } });
      break;
      
    case 'join_room':
      if (ws.userId) {
        joinRoom(ws.userId, message.data.room);
      }
      break;
      
    case 'leave_room':
      if (ws.userId) {
        leaveRoom(ws.userId, message.data.room);
      }
      break;
      
    default:
      // Handle other message types
      if (ws.userId) {
        message.userId = ws.userId;
        await handleRealtimeEvent(message);
      }
      break;
  }
}

async function handleAuthentication(ws: AuthenticatedWebSocket, message: WSMessage) {
  try {
    const { token, userId } = message.data;
    
    if (token) {
      // JWT authentication
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      ws.userId = decoded.userId;
      ws.userRole = decoded.role;
    } else if (userId) {
      // Session-based authentication (fallback)
      const user = await storage.getUser(parseInt(userId));
      if (user) {
        ws.userId = userId.toString();
        ws.userRole = user.role || 'user';
      } else {
        sendError(ws, 'Invalid user ID');
        return;
      }
    } else {
      sendError(ws, 'Authentication required');
      return;
    }
    
    // Register the client
    if (ws.userId) {
      clients.set(ws.userId, ws);
      
      // Send authentication success
      sendMessage(ws, {
        type: 'auth',
        data: { 
          success: true, 
          userId: ws.userId,
          role: ws.userRole,
          connectedAt: Date.now()
        }
      });
      
      // Broadcast user online status
      broadcastUserStatus(ws.userId);
    }
    
    console.log(`User ${ws.userId || 'unknown'} authenticated on WebSocket`);
  } catch (error) {
    console.error('Authentication error:', error);
    sendError(ws, 'Authentication failed');
  }
}

async function handleRealtimeEvent(message: WSMessage) {
  // Store activity in database
  if (message.type.includes('_created') || message.type.includes('_updated')) {
    try {
      const activityData = {
        userId: parseInt(message.userId || '0'),
        actionType: message.type.includes('_created') ? 'create' : 'update',
        targetType: message.type.split('_')[0], // e.g., 'lead' from 'lead_updated'
        targetId: message.data.id || 0,
        description: generateActivityDescription(message),
      };
      
      await storage.createActivity(activityData);
    } catch (error) {
      console.error('Error creating activity record:', error);
    }
  }
  
  // Broadcast to relevant clients
  switch (message.type) {
    case 'lead_updated':
      // Broadcast to all clients and send to specific rooms
      broadcastMessage(message);
      broadcastToRoom('leads', message);
      break;
      
    case 'call_started':
    case 'call_ended':
      // Broadcast to team members
      broadcastToRoom('calls', message);
      break;
      
    default:
      broadcastMessage(message);
      break;
  }
}

function generateActivityDescription(message: WSMessage): string {
  switch (message.type) {
    case 'lead_created':
      return `Created new lead: ${message.data.propertyAddress}`;
    case 'lead_updated':
      return `Updated lead: ${message.data.propertyAddress}`;
    case 'call_created':
      return `Logged call for lead: ${message.data.leadName || 'Unknown'}`;
    case 'call_scheduled':
      return `Scheduled call for lead: ${message.data.leadName || 'Unknown'}`;
    default:
      return `Performed ${message.type.replace('_', ' ')}`;
  }
}

function joinRoom(userId: string, room: string) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  rooms.get(room)!.add(userId);
}

function leaveRoom(userId: string, room: string) {
  const roomUsers = rooms.get(room);
  if (roomUsers) {
    roomUsers.delete(userId);
    if (roomUsers.size === 0) {
      rooms.delete(room);
    }
  }
}

function leaveAllRooms(userId: string) {
  rooms.forEach((users, room) => {
    users.delete(userId);
    if (users.size === 0) {
      rooms.delete(room);
    }
  });
}

function broadcastToRoom(room: string, message: WSMessage) {
  const roomUsers = rooms.get(room);
  if (roomUsers) {
    roomUsers.forEach(userId => {
      sendMessageToUser(userId, message);
    });
  }
}

function broadcastUserStatus(userId: string) {
  broadcastMessage({
    type: 'team_member_online',
    data: { userId, timestamp: Date.now() }
  });
}

function sendMessage(ws: AuthenticatedWebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: AuthenticatedWebSocket, error: string) {
  sendMessage(ws, { type: 'error', data: { error, timestamp: Date.now() } });
}

// Broadcast message to all authenticated clients
export function broadcastMessage(message: WSMessage) {
  clients.forEach((client, userId) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Send message to a specific user
export function sendMessageToUser(userId: string | number, message: WSMessage) {
  const userIdStr = userId.toString();
  const client = clients.get(userIdStr);
  
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

// Send message to users by role
export function sendMessageToRole(role: string, message: WSMessage) {
  clients.forEach((client, userId) => {
    if (client.readyState === WebSocket.OPEN && client.userRole === role) {
      client.send(JSON.stringify(message));
    }
  });
}

// Get connected users count
export function getConnectedUsersCount(): number {
  return clients.size;
}

// Get connected users list
export function getConnectedUsers(): Array<{ userId: string; role: string; connectedAt: number }> {
  const users: Array<{ userId: string; role: string; connectedAt: number }> = [];
  clients.forEach((client, userId) => {
    if (client.readyState === WebSocket.OPEN) {
      users.push({
        userId,
        role: client.userRole || 'unknown',
        connectedAt: client.lastPing || Date.now()
      });
    }
  });
  return users;
}
