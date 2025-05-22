
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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [clientId] = useState(() => uuidv4()); // Generate unique client ID
  const [isLocalUpdate, setIsLocalUpdate] = useState(false);
  
  const documentVersionRef = useRef<number>(0);
  const lastProcessedUpdateRef = useRef<DocumentUpdateInfo | null>(null);

  // Initialize document and set up real-time subscription
  useEffect(() => {
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
              documentVersionRef.current = 1;
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
          console.log("Initial content loaded:", data.content, "Last updated:", data.updated_at, "Version:", data.version);
          setContent(data.content || initialContent);
          if (data.updated_at) {
            setLastSaved(new Date(data.updated_at));
          }
          if (data.version) {
            documentVersionRef.current = data.version;
          }
          // Track the last processed update
          lastProcessedUpdateRef.current = {
            version: documentVersionRef.current,
            timestamp: Date.now(),
            clientId: data.client_id || clientId
          };
        }

        // Set up real-time subscription with improved update handling
        const channel = supabase
          .channel('documents-changes')
          .on('postgres_changes', 
              { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` }, 
              (payload: any) => {
                const newContent = payload.new.content;
                const updateClientId = payload.new.client_id;
                const updateVersion = payload.new.version || 0;
                const updateTimestamp = new Date(payload.new.updated_at).getTime();
                
                console.log("Realtime update received from client:", updateClientId, "Version:", updateVersion);
                console.log("My client ID:", clientId, "My version:", documentVersionRef.current);
                
                // Enhanced update logic with version, timestamp and client ID verification
                if (updateClientId !== clientId && newContent !== content) {
                  // Check if we've processed a newer update already
                  const lastProcessed = lastProcessedUpdateRef.current;
                  
                  if (!lastProcessed || 
                      updateVersion > lastProcessed.version || 
                      (updateVersion === lastProcessed.version && 
                       updateTimestamp > lastProcessed.timestamp)) {
                    
                    console.log("Applying external update from another client");
                    setContent(newContent);
                    
                    if (payload.new.updated_at) {
                      setLastSaved(new Date(payload.new.updated_at));
                    }
                    
                    // Update the last processed information
                    lastProcessedUpdateRef.current = {
                      version: updateVersion,
                      timestamp: updateTimestamp,
                      clientId: updateClientId
                    };
                    
                    documentVersionRef.current = updateVersion;
                  } else {
                    console.log("Ignoring outdated update");
                  }
                } else {
                  console.log("Ignoring own update or duplicate content");
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
  }, [documentId, clientId, initialContent]);

  const saveContent = async (newContent: string) => {
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
        setLastSaved(new Date());
        
        // Update last processed version information
        lastProcessedUpdateRef.current = {
          version: currentVersion,
          timestamp: Date.now(),
          clientId: clientId
        };
        
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
      // Reset local update flag after a delay
      setTimeout(() => setIsLocalUpdate(false), 300);
    }
  };

  return {
    content,
    setContent,
    loading,
    error,
    isSaving,
    lastSaved,
    isLocalUpdate,
    clientId,
    saveContent
  };
};
