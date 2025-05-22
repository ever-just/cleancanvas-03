
import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { 
  getSocket,
  disconnectSocket,
  joinDocument,
  leaveDocument,
  sendDocumentUpdate,
  requestDocumentContent
} from '@/utils/socket';

interface UseSocketSyncProps {
  documentId: string;
  initialContent?: string;
}

export const useSocketSync = ({ documentId, initialContent = "" }: UseSocketSyncProps) => {
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [clientId] = useState(() => uuidv4());
  
  // Initialize connection and set up listeners
  useEffect(() => {
    console.log("=== SOCKET SYNC INITIALIZATION ===");
    console.log("Initializing document with client ID:", clientId);
    
    try {
      setLoading(true);
      
      // Try to get content from localStorage first for faster initial load
      const savedContent = localStorage.getItem(`document_${documentId}_content`);
      if (savedContent) {
        console.log("Restoring content from localStorage");
        setContent(savedContent);
      } else {
        setContent(initialContent);
      }
      
      // Set up socket connection
      const socket = getSocket();
      
      // Join the document room
      joinDocument(documentId, clientId);
      
      // Request latest document content from server
      requestDocumentContent(documentId);
      
      // Set up listeners for document events
      socket.on('document_content', (data: { content: string; updatedAt: string }) => {
        console.log("Received document content from server");
        setContent(data.content);
        if (data.updatedAt) {
          setLastSaved(new Date(data.updatedAt));
        }
        setLoading(false);
      });
      
      socket.on('document_updated', (data: { 
        content: string; 
        updatedAt: string; 
        clientId: string;
      }) => {
        console.log("=== DOCUMENT UPDATE RECEIVED ===");
        
        // Skip updates from the same client (our own updates)
        if (data.clientId === clientId) {
          console.log("Ignoring own update (same client ID)");
          return;
        }
        
        console.log("Applying external update");
        setContent(data.content);
        setLastSaved(new Date(data.updatedAt));
        toast.info("Document was updated by another user");
      });
      
      socket.on('document_error', (errorData: { message: string }) => {
        console.error("Document error:", errorData.message);
        setError(errorData.message);
        setLoading(false);
        toast.error(errorData.message);
      });

      // Mark loading complete if socket takes too long
      const loadingTimeout = setTimeout(() => {
        if (loading) {
          console.log("Socket taking too long, showing content anyway");
          setLoading(false);
        }
      }, 3000);
      
      // Clean up function
      return () => {
        console.log("Cleaning up socket connection");
        leaveDocument(documentId, clientId);
        socket.off('document_content');
        socket.off('document_updated');
        socket.off('document_error');
        clearTimeout(loadingTimeout);
      };
    } catch (err) {
      console.error("Setup error:", err);
      setError("Failed to initialize. Please check your connection.");
      setLoading(false);
    }
  }, [documentId, clientId, initialContent]);

  // Save content to localStorage when it changes
  useEffect(() => {
    if (content && !loading) {
      localStorage.setItem(`document_${documentId}_content`, content);
    }
  }, [content, documentId, loading]);

  // Handle beforeunload to save content
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.setItem(`document_${documentId}_content`, content);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [content, documentId]);

  // Function to manually refresh content from server
  const refreshContent = useCallback(async () => {
    console.log("=== MANUAL REFRESH REQUESTED ===");
    setIsRefreshing(true);
    
    try {
      requestDocumentContent(documentId);
      
      // Set a timeout for the response
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("Refresh timed out")), 5000);
      });
      
      // Create a promise that resolves when document_content is received
      const refreshPromise = new Promise<void>((resolve) => {
        const socket = getSocket();
        const onContent = (data: { content: string; updatedAt: string }) => {
          console.log("Received refreshed content from server");
          setContent(data.content);
          if (data.updatedAt) {
            setLastSaved(new Date(data.updatedAt));
          }
          socket.off('document_content', onContent);
          resolve();
        };
        
        socket.on('document_content', onContent);
      });
      
      await Promise.race([refreshPromise, timeoutPromise]);
      console.log("=== MANUAL REFRESH COMPLETED ===");
      return Promise.resolve();
    } catch (err) {
      console.error("Refresh error:", err);
      toast.error("Failed to refresh. Please try again.");
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  }, [documentId]);

  // Function to save content to server
  const saveContent = useCallback(async (newContent: string) => {
    console.log("=== SAVE CONTENT OPERATION STARTED ===");
    
    // Skip saving if content is empty
    if (!newContent || newContent.trim() === "") {
      console.log("Empty content, skipping save");
      return Promise.reject(new Error("Cannot save empty content"));
    }
    
    console.log(`Saving content with length: ${newContent.length}`);
    console.log("Content sample:", newContent.substring(0, 50));
    
    setIsSaving(true);
    
    // Save to localStorage as a backup
    localStorage.setItem(`document_${documentId}_content`, newContent);
    
    try {
      console.log("Saving via Socket.io with client ID:", clientId);
      sendDocumentUpdate(documentId, newContent, clientId);
      
      // Create a promise that resolves when the save is acknowledged
      const savePromise = new Promise<void>((resolve, reject) => {
        const socket = getSocket();
        
        const onSaved = (data: { success: boolean; updatedAt?: string; error?: string }) => {
          socket.off('document_saved', onSaved);
          
          if (data.success) {
            const newTimestamp = data.updatedAt ? new Date(data.updatedAt) : new Date();
            setContent(newContent);
            setLastSaved(newTimestamp);
            console.log("Update complete - New timestamp:", newTimestamp.toLocaleTimeString());
            resolve();
          } else {
            console.error("Save error:", data.error);
            reject(new Error(data.error || "Failed to save document"));
          }
        };
        
        socket.once('document_saved', onSaved);
        
        // Set a timeout in case the server doesn't respond
        setTimeout(() => {
          socket.off('document_saved', onSaved);
          
          // If we don't get a confirmation, we still update locally
          setContent(newContent);
          setLastSaved(new Date());
          
          // We resolve with a warning instead of rejecting
          console.warn("Save operation timed out, but content was updated locally");
          resolve();
        }, 5000);
      });
      
      await savePromise;
      console.log("=== SAVE CONTENT OPERATION COMPLETED ===");
      return Promise.resolve();
    } catch (err) {
      console.error("Save error:", err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [documentId, clientId]);

  return {
    content,
    setContent,
    loading,
    error,
    isSaving,
    isRefreshing,
    lastSaved,
    clientId,
    saveContent,
    refreshContent
  };
};
