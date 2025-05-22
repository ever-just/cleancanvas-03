
import { useEffect, useState } from "react";
import TextEditor from "@/components/TextEditor";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

const Index = () => {
  const [content, setContent] = useState("");
  const [supabase, setSupabaseClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        // This is just a placeholder - after connecting to Supabase, 
        // these values will be properly configured
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          setError("Missing Supabase configuration. Please connect to Supabase first.");
          setLoading(false);
          return;
        }

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
        setSupabaseClient(supabaseClient);

        // Fetch initial content
        const { data, error } = await supabaseClient
          .from('documents')
          .select('content')
          .eq('id', 'shared')
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Document doesn't exist yet, create it
            await supabaseClient
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
        const subscription = supabaseClient
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
          .subscribe((status: string) => {
            if (status !== 'SUBSCRIBED') {
              console.error("Failed to subscribe to real-time updates");
            }
          });

        setLoading(false);
        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("Setup error:", err);
        setError("Failed to initialize. Please check your connection.");
        setLoading(false);
      }
    };

    initializeSupabase();
  }, []);

  const handleContentChange = async (newContent: string) => {
    setContent(newContent);
    
    if (supabase) {
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
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <div className="p-4 max-w-md">
          <p className="text-lg">{error}</p>
          <p className="mt-4 text-sm">
            Please make sure you've connected your Lovable project to Supabase using the Supabase 
            button in the top right corner.
          </p>
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
