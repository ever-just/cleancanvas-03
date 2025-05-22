
import { io, Socket } from 'socket.io-client';

// Default to a local development server if no environment variable is set
// In production, this would be set to your actual Socket.io server URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let socketDisconnectTimeout: number | null = null;

/**
 * Initialize and get socket connection
 * Creates a singleton socket instance
 */
export const getSocket = (): Socket => {
  if (!socket) {
    console.log('Initializing socket connection to:', SOCKET_URL);
    
    socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log('Socket connected with ID:', socket?.id);
      if (socketDisconnectTimeout) {
        window.clearTimeout(socketDisconnectTimeout);
        socketDisconnectTimeout = null;
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      
      // If server disconnected us, try to reconnect after a delay
      if (reason === 'io server disconnect') {
        socketDisconnectTimeout = window.setTimeout(() => {
          socket?.connect();
        }, 5000);
      }
    });
  }
  
  return socket;
};

/**
 * Disconnect socket connection
 * Call this when the component is unmounted
 */
export const disconnectSocket = (): void => {
  if (socket) {
    console.log('Disconnecting socket');
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join document editing session
 */
export const joinDocument = (documentId: string, clientId: string): void => {
  const socket = getSocket();
  socket.emit('join_document', { documentId, clientId });
};

/**
 * Leave document editing session
 */
export const leaveDocument = (documentId: string, clientId: string): void => {
  const socket = getSocket();
  socket.emit('leave_document', { documentId, clientId });
};

/**
 * Send document content to server
 */
export const sendDocumentUpdate = (
  documentId: string, 
  content: string, 
  clientId: string
): void => {
  const socket = getSocket();
  socket.emit('document_update', { documentId, content, clientId });
};

/**
 * Get initial document content from server
 */
export const requestDocumentContent = (documentId: string): void => {
  const socket = getSocket();
  socket.emit('get_document', { documentId });
};
