
import { useEffect, useState } from "react";
import TextEditor from "@/components/TextEditor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    const initializeDocument = async () => {
      try {
        console.log("Initializing document...");
        // Fetch initial content
        const { data, error } = await supabase
          .from('documents')
          .select('content, updated_at')
          .eq('id', 'shared')
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Document doesn't exist yet, create it
            console.log("Document doesn't exist, creating it...");
            const { error: insertError } = await supabase
              .from('documents')
              .insert({ id: 'shared', content: '' });
              
            if (insertError) {
              console.error("Error creating document:", insertError);
              throw insertError;
            } else {
              console.log("Successfully created empty document");
              setContent('');
            }
          } else {
            console.error("Error fetching document:", error);
            setError("Failed to load document. Please try again.");
            // Try to recover from local storage if available
            const savedContent = localStorage.getItem('document_content');
            if (savedContent) {
              console.log("Recovering content from local storage");
              setContent(savedContent);
            }
          }
        } else if (data) {
          console.log("Initial content loaded:", data.content, "Last updated:", data.updated_at);
          setContent(data.content || '');
          if (data.updated_at) {
            setLastSaved(new Date(data.updated_at));
          }
        }

        // Set up real-time subscription
        const channel = supabase
          .channel('documents-changes')
          .on('postgres_changes', 
              { event: 'UPDATE', schema: 'public', table: 'documents', filter: 'id=eq.shared' }, 
              (payload: any) => {
                const newContent = payload.new.content;
                console.log("Realtime update received:", newContent);
                // Only update if content is different to prevent loops
                if (newContent !== content) {
                  setContent(newContent);
                  if (payload.new.updated_at) {
                    setLastSaved(new Date(payload.new.updated_at));
                  }
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
      localStorage.setItem('document_content', content);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleContentChange = async (newContent: string) => {
    console.log(`Content change handler called with text length: ${newContent.length}`);
    console.log("Content sample:", newContent.substring(0, 50));
    setContent(newContent);
    
    // Save to localStorage as a backup
    localStorage.setItem('document_content', newContent);
    
    setIsSaving(true);
    
    try {
      console.log("Saving to Supabase...");
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('documents')
        .update({ content: newContent })
        .eq('id', 'shared')
        .select();
        
      const duration = Date.now() - startTime;
      
      if (error) {
        console.error("Error updating document:", error);
        toast.error("Failed to save changes");
      } else {
        console.log(`Document successfully updated in ${duration}ms:`, data);
        setLastSaved(new Date());
        toast.success("Changes saved", { 
          id: "save-notification",
          duration: 1000 
        });
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <div className="p-4 max-w-md">
          <p className="text-lg">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {loading ? (
        <div className="h-screen flex items-center justify-center">
          <p className="text-black text-lg">Loading document...</p>
        </div>
      ) : (
        <>
          <div className="fixed top-0 right-0 p-2 z-10 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-bl-md">
            {isSaving ? (
              <span className="text-xs text-gray-600">Saving...</span>
            ) : lastSaved ? (
              <span className="text-xs text-gray-600">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          <TextEditor 
            content={content} 
            onChange={handleContentChange} 
          />
        </>
      )}
    </div>
  );
};

export default Index;
