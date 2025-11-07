import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

// Define WebSocket message types
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
  | 'auth';

// Define WebSocket message interface
export interface WSMessage {
  type: WSMessageType;
  data: any;
}

type WebSocketContextType = {
  connected: boolean;
  lastMessage: WSMessage | null;
  sendMessage: (message: WSMessage) => void;
  error: string | null;
  isReconnecting: boolean;
  reconnectAttempts: number;
};

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Handle reconnection with exponential backoff
  const handleReconnection = () => {
    if (reconnectAttempts >= 5) {
      setError("Maximum reconnection attempts reached. Please refresh the page.");
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Max 30 seconds
    
    console.log(`Attempting reconnection ${reconnectAttempts + 1} in ${delay}ms`);
    
    setTimeout(() => {
      if (socket === null) {
        setReconnectAttempts(prev => prev + 1);
        // Trigger reconnection by re-running the effect
        setSocket(undefined as any);
      }
    }, delay);
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const newSocket = new WebSocket(wsUrl);
      setError(null);

      // Set up event handlers
      newSocket.onopen = () => {
        console.log('WebSocket connection established');
        setConnected(true);
        setIsReconnecting(false);
        setReconnectAttempts(0);
        
        // Send authentication message with user ID
        newSocket.send(JSON.stringify({
          type: 'auth',
          data: {
            userId: user.id
          }
        }));
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket connection closed', event.code, event.reason);
        setConnected(false);
        
        // Don't reconnect if the close was intentional (code 1000)
        if (event.code !== 1000) {
          handleReconnection();
        }
      };

      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
        setError('WebSocket connection error');
      };

      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          setLastMessage(message);
          handleIncomingMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          toast({
            title: 'WebSocket Error',
            description: 'Failed to parse incoming message',
            variant: 'destructive'
          });
        }
      };

      setSocket(newSocket);

      // Clean up on unmount
      return () => {
        newSocket.close(1000, 'Component unmounting');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setError('Failed to establish WebSocket connection');
      handleReconnection();
    }
  }, [user, socket]);

  // Handle incoming messages
  const handleIncomingMessage = (message: WSMessage) => {
    switch (message.type) {
      case 'activity_created':
        queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
        toast({
          title: 'New Activity',
          description: `${message.data.description}`,
        });
        break;
      
      case 'lead_created':
        queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
        toast({
          title: 'New Lead',
          description: `${message.data.name} was added`,
        });
        break;
      
      case 'lead_updated':
        queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/leads', message.data.id] });
        toast({
          title: 'Lead Updated',
          description: `Lead information was updated`,
        });
        break;
      
      case 'lead_status_changed':
        queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/leads', message.data.leadId] });
        toast({
          title: 'Lead Status Changed',
          description: `${message.data.propertyAddress} status changed from ${message.data.oldStatus} to ${message.data.newStatus}`,
        });
        break;
      
      case 'call_created':
        queryClient.invalidateQueries({ queryKey: ['/api/calls'] });
        toast({
          title: 'Call Logged',
          description: `A call was logged for ${message.data.leadName || 'a lead'}`,
        });
        break;
      
      case 'call_scheduled':
        queryClient.invalidateQueries({ queryKey: ['/api/scheduled-calls'] });
        toast({
          title: 'Call Scheduled',
          description: `A call was scheduled for ${message.data.leadName || 'a lead'}`,
        });
        break;
      
      case 'call_started':
        queryClient.invalidateQueries({ queryKey: ['/api/scheduled-calls'] });
        toast({
          title: 'Call Started',
          description: `${message.data.callerName} started a call with ${message.data.leadName}`,
        });
        break;
      
      case 'call_ended':
        queryClient.invalidateQueries({ queryKey: ['/api/scheduled-calls'] });
        queryClient.invalidateQueries({ queryKey: ['/api/calls'] });
        toast({
          title: 'Call Ended',
          description: `${message.data.callerName} ended call with ${message.data.leadName} (${message.data.status})`,
        });
        break;
      
      case 'team_member_online':
        toast({
          title: 'Team Member Online',
          description: `Team member ${message.data.userId} is now online`,
        });
        break;
      
      case 'team_member_offline':
        toast({
          title: 'Team Member Offline',
          description: `Team member ${message.data.userId} is now offline`,
        });
        break;
      
      case 'notification':
        toast({
          title: message.data.title || 'Notification',
          description: message.data.message,
          variant: message.data.variant || 'default',
        });
        break;
    }
  };

  // Send message to WebSocket server
  const sendMessage = (message: WSMessage) => {
    if (socket && socket.readyState === WebSocket.OPEN && user) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  };

  return (
    <WebSocketContext.Provider value={{ 
      connected, 
      sendMessage, 
      lastMessage, 
      error, 
      isReconnecting, 
      reconnectAttempts 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === null) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

// Connection status indicator component
export function ConnectionStatus() {
  const { connected, error, isReconnecting, reconnectAttempts } = useWebSocket();
  
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span>{error}</span>
      </div>
    );
  }
  
  if (isReconnecting) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <span>Reconnecting... (attempt {reconnectAttempts + 1}/5)</span>
      </div>
    );
  }
  
  if (connected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Connected</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
      <span>Disconnected</span>
    </div>
  );
}