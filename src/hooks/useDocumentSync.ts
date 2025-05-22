
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';

interface UseDocumentSyncProps {
  documentId: string;
  initialContent?: string;
}

interface DocumentUpdateInfo {
  version: number;
  timestamp: number;
  clientId: string;
}

export const useDocumentSync = ({ documentId, initialContent = "" }: UseDocumentSyncProps) => {
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [clientId] = useState(() => uuidv4()); // Generate unique client ID
  const [isLocalUpdate, setIsLocalUpdate] = useState(false);
  
  // Track document version for optimistic updates
  const documentVersionRef = useRef<number>(0);
  // Last processed update timestamp - primary source of truth for update decisions
  const lastServerTimestampRef = useRef<number>(0);
  const lastProcessedUpdateRef = useRef<DocumentUpdateInfo | null>(null);
  // Track the last saved content to avoid unnecessary saves
  const lastSavedContentRef = useRef<string>(initialContent);
  // Track when the last force sync check was performed
  const lastSyncCheckRef = useRef<number>(Date.now());
  // Force sync interval (30 seconds)
  const FORCE_SYNC_INTERVAL = 30000;

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
              lastSavedContentRef.current = initialContent;
              documentVersionRef.current = 1;
              lastServerTimestampRef.current = Date.now();
            }
          } else {
            console.error("Error fetching document:", error);
            setError("Failed to load document. Please try again.");
            // Try to recover from local storage if available
            const savedContent = localStorage.getItem(`document_${documentId}_content`);
            if (savedContent) {
              console.log("Recovering content from local storage");
              setContent(savedContent);
              lastSavedContentRef.current = savedContent;
            }
          }
        } else if (data) {
          console.log("Initial content loaded. Updated at:", data.updated_at, "Version:", data.version);
          setContent(data.content || initialContent);
          lastSavedContentRef.current = data.content || initialContent;
          if (data.updated_at) {
            const serverTimestamp = new Date(data.updated_at).getTime();
            setLastSaved(new Date(data.updated_at));
            lastServerTimestampRef.current = serverTimestamp;
          }
          if (data.version) {
            documentVersionRef.current = data.version;
          }
          // Track the last processed update
          lastProcessedUpdateRef.current = {
            version: documentVersionRef.current,
            timestamp: lastServerTimestampRef.current,
            clientId: data.client_id || clientId
          };
        }

        // Set up real-time subscription with improved update handling
        const channel = supabase
          .channel('documents-changes')
          .on('postgres_changes', 
              { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` }, 
              (payload: any) => {
                console.log("=== REALTIME UPDATE RECEIVED ===");
                const newContent = payload.new.content;
                const updateClientId = payload.new.client_id;
                const updateVersion = payload.new.version || 0;
                const updateTimestamp = new Date(payload.new.updated_at).getTime();
                
                console.log(`Update from client: ${updateClientId}`, 
                  `\n- Server timestamp: ${new Date(updateTimestamp).toLocaleTimeString()}`,
                  `\n- Local timestamp: ${lastServerTimestampRef.current ? new Date(lastServerTimestampRef.current).toLocaleTimeString() : 'none'}`,
                  `\n- Version: ${updateVersion} vs local: ${documentVersionRef.current}`
                );
                
                // Enhanced update logic prioritizing timestamps over client IDs and versions
                // Skip updates from the same client (our own updates that got echoed back)
                if (updateClientId === clientId) {
                  console.log("Ignoring own update (same client ID)");
                  return;
                }
                
                // Accept update if the timestamp is newer than our last processed timestamp
                // This is the primary condition for accepting updates
                if (updateTimestamp > lastServerTimestampRef.current) {
                  console.log("Applying external update with newer timestamp");
                  setContent(newContent);
                  lastSavedContentRef.current = newContent;
                  
                  if (payload.new.updated_at) {
                    setLastSaved(new Date(payload.new.updated_at));
                  }
                  
                  // Update the last processed information
                  lastProcessedUpdateRef.current = {
                    version: updateVersion,
                    timestamp: updateTimestamp,
                    clientId: updateClientId
                  };
                  
                  lastServerTimestampRef.current = updateTimestamp;
                  documentVersionRef.current = updateVersion;
                } else {
                  console.log("Ignoring update with older or same timestamp");
                }
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
  }, [documentId, clientId, initialContent, content]);

  // New function to manually refresh content from server
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
        toast.error("Failed to refresh document");
        return;
      }
      
      if (data) {
        const serverTimestamp = new Date(data.updated_at).getTime();
        
        // Only update if server content is different
        if (data.content !== content) {
          console.log("Server content differs from local, updating...");
          setContent(data.content);
          lastSavedContentRef.current = data.content;
          setLastSaved(new Date(data.updated_at));
          lastServerTimestampRef.current = serverTimestamp;
          
          // Update last processed version information
          lastProcessedUpdateRef.current = {
            version: data.version,
            timestamp: serverTimestamp,
            clientId: data.client_id
          };
          
          documentVersionRef.current = data.version;
          
          toast.success("Document refreshed from server");
        } else {
          console.log("Server content is identical, no update needed");
          toast.info("Document is already up to date");
        }
      }
    } catch (err) {
      console.error("Refresh error:", err);
      toast.error("Failed to refresh document");
    } finally {
      setIsRefreshing(false);
      console.log("=== MANUAL REFRESH COMPLETED ===");
    }
  };

  const saveContent = async (newContent: string) => {
    console.log("=== SAVE CONTENT OPERATION STARTED ===");
    // Skip saving if content hasn't changed since last save
    if (newContent === lastSavedContentRef.current) {
      console.log("Content unchanged since last save, skipping update");
      return;
    }
    
    console.log(`Saving content with length: ${newContent.length}`);
    console.log("Content sample:", newContent.substring(0, 50));
    
    setIsLocalUpdate(true);
    setContent(newContent);
    
    // Save to localStorage as a backup
    localStorage.setItem(`document_${documentId}_content`, newContent);
    
    setIsSaving(true);
    
    try {
      // Increment version for this update
      documentVersionRef.current += 1;
      const currentVersion = documentVersionRef.current;
      
      console.log("Saving to Supabase with client ID:", clientId, "Version:", currentVersion);
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('documents')
        .update({ 
          content: newContent,
          client_id: clientId,
          version: currentVersion
        })
        .eq('id', documentId)
        .select();
        
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error("Error updating document:", error);
        toast.error("Failed to save changes");
        // Revert version increment on error
        documentVersionRef.current -= 1;
      } else {
        console.log(`Document successfully updated in ${duration}ms:`, data);
        const newTimestamp = new Date();
        setLastSaved(newTimestamp);
        lastSavedContentRef.current = newContent;
        lastServerTimestampRef.current = newTimestamp.getTime();
        
        // Update last processed version information
        lastProcessedUpdateRef.current = {
          version: currentVersion,
          timestamp: newTimestamp.getTime(),
          clientId: clientId
        };
        
        console.log("Update complete - New timestamp:", newTimestamp.toLocaleTimeString());
        
        toast.success("Changes saved", { 
          id: "save-notification",
          duration: 1000 
        });
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to save changes");
      // Revert version increment on error
      documentVersionRef.current -= 1;
    } finally {
      setIsSaving(false);
      // Reset local update flag after a delay (5 seconds)
      setTimeout(() => setIsLocalUpdate(false), 5000);
      console.log("=== SAVE CONTENT OPERATION COMPLETED ===");
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
    isLocalUpdate,
    clientId,
    saveContent,
    refreshContent
  };
};
