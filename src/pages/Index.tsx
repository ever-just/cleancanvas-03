
import { useEffect, useState } from "react";
import TextEditor from "@/components/TextEditor";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeDocument = async () => {
      try {
        // Fetch initial content
        const { data, error } = await supabase
          .from('documents')
          .select('content')
          .eq('id', 'shared')
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Document doesn't exist yet, create it
            await supabase
              .from('documents')
              .insert({ id: 'shared', content: '' });
            setContent('');
          } else {
            console.error("Error fetching document:", error);
            setError("Failed to load document. Please try again.");
          }
        } else if (data) {
          setContent(data.content || '');
        }

        // Set up real-time subscription
        const channel = supabase
          .channel('documents-changes')
          .on('postgres_changes', 
              { event: 'UPDATE', schema: 'public', table: 'documents', filter: 'id=eq.shared' }, 
              (payload: any) => {
                const newContent = payload.new.content;
                // Only update if content is different to prevent loops
                if (newContent !== content) {
                  setContent(newContent);
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
  }, []);

  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
    
    try {
      const { error } = await supabase
        .from('documents')
        .update({ content: newContent })
        .eq('id', 'shared');
        
      if (error) {
        console.error("Error updating document:", error);
        toast.error("Failed to save changes");
      }
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to save changes");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <div className="p-4 max-w-md">
          <p className="text-lg">{error}</p>
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
        <TextEditor content={content} onChange={handleContentChange} />
      )}
    </div>
  );
};

export default Index;
