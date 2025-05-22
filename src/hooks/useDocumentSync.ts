
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

interface UseDocumentSyncProps {
  documentId: string;
  initialContent?: string;
}

export const useDocumentSync = ({ documentId, initialContent = "" }: UseDocumentSyncProps) => {
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [clientId] = useState(() => uuidv4()); // Generate unique client ID
  
  // Initialize document and set up real-time subscription
  useEffect(() => {
    console.log("=== DOCUMENT SYNC INITIALIZATION ===");
    const initializeDocument = async () => {
      try {
        console.log("Initializing document with client ID:", clientId);
        // Fetch initial content
        const { data, error } = await supabase
          .from('documents')
          .select('content, updated_at, client_id, version')
          .eq('id', documentId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Document doesn't exist yet, create it
            console.log("Document doesn't exist, creating it...");
            const { error: insertError } = await supabase
              .from('documents')
              .insert({ 
                id: documentId, 
                content: initialContent,
                client_id: clientId,
                version: 1
              });
              
            if (insertError) {
              console.error("Error creating document:", insertError);
              throw insertError;
            } else {
              console.log("Successfully created empty document");
              setContent(initialContent);
              setLastSaved(new Date());
            }
          } else {
            console.error("Error fetching document:", error);
            setError("Failed to load document. Please try again.");
            // Try to recover from local storage if available
            const savedContent = localStorage.getItem(`document_${documentId}_content`);
            if (savedContent) {
              console.log("Recovering content from local storage");
              setContent(savedContent);
            }
          }
        } else if (data) {
          console.log("Initial content loaded. Updated at:", data.updated_at);
          console.log("Content preview:", data.content ? data.content.substring(0, 50) : "empty");
          setContent(data.content || initialContent);
          
          if (data.updated_at) {
            setLastSaved(new Date(data.updated_at));
          }
        }

        // Set up real-time subscription
        const channel = supabase
          .channel('documents-changes')
          .on('postgres_changes', 
              { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` }, 
              (payload: any) => {
                console.log("=== REALTIME UPDATE RECEIVED ===");
                const newContent = payload.new.content;
                const updateClientId = payload.new.client_id;
                
                // Skip updates from the same client (our own updates that got echoed back)
                if (updateClientId === clientId) {
                  console.log("Ignoring own update (same client ID)");
                  return;
                }
                
                console.log("Applying external update");
                setContent(newContent);
                
                if (payload.new.updated_at) {
                  setLastSaved(new Date(payload.new.updated_at));
                }
                
                toast.info("Document was updated by another user");
              })
          .subscribe();

        setLoading(false);

        return () => {
          supabase.channel('documents-changes').unsubscribe();
        };
      } catch (err) {
        console.error("Setup error:", err);
        setError("Failed to initialize. Please check your connection.");
        setLoading(false);
      }
    };

    initializeDocument();
    
    // Save content to localStorage on page unload
    const handleBeforeUnload = () => {
      localStorage.setItem(`document_${documentId}_content`, content);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [documentId, clientId, initialContent]);

  // Function to manually refresh content from server
  const refreshContent = async () => {
    console.log("=== MANUAL REFRESH REQUESTED ===");
    setIsRefreshing(true);
    
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content, updated_at, client_id, version')
        .eq('id', documentId)
        .single();
        
      if (error) {
        console.error("Error refreshing document:", error);
        throw new Error("Failed to refresh document");
      }
      
      if (data) {
        console.log("Refreshing with server content:", data.content?.substring(0, 50));
        setContent(data.content || "");
        
        if (data.updated_at) {
          setLastSaved(new Date(data.updated_at));
        }
      }
      
      console.log("=== MANUAL REFRESH COMPLETED ===");
      return Promise.resolve();
    } catch (err) {
      console.error("Refresh error:", err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to save content to server
  const saveContent = async (newContent: string) => {
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
      console.log("Saving to Supabase with client ID:", clientId);
      const { data, error } = await supabase
        .from('documents')
        .update({ 
          content: newContent,
          client_id: clientId
        })
        .eq('id', documentId)
        .select();
        
      if (error) {
        console.error("Error updating document:", error);
        throw error;
      } else {
        console.log("Document successfully updated:", data);
        const newTimestamp = new Date();
        setContent(newContent);
        setLastSaved(newTimestamp);
        
        console.log("Update complete - New timestamp:", newTimestamp.toLocaleTimeString());
      }
      
      console.log("=== SAVE CONTENT OPERATION COMPLETED ===");
      return Promise.resolve();
    } catch (err) {
      console.error("Update error:", err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

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
