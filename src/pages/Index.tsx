
import { useEffect, useState, useRef } from "react";
import TextEditor from "@/components/TextEditor";
import { useDocumentSync } from "@/hooks/useDocumentSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const {
    content,
    loading,
    error,
    isSaving,
    isRefreshing,
    lastSaved,
    saveContent,
    refreshContent
  } = useDocumentSync({
    documentId: 'shared'
  });

  const [isDirty, setIsDirty] = useState(false);
  const [localContent, setLocalContent] = useState("");
  
  // Set initial content when it's loaded
  useEffect(() => {
    if (!loading && content) {
      console.log("Index: Setting initial editor content:", content.substring(0, 50));
      setLocalContent(content);
    }
  }, [loading, content]);

  const handleContentChange = (newContent: string) => {
    console.log("Index: Content changed by user, length:", newContent.length);
    setLocalContent(newContent);
    setIsDirty(true);
  };

  const handleSave = () => {
    console.log("Index: Save button clicked");
    
    if (!localContent || localContent.trim() === "") {
      toast.error("Cannot save empty content");
      return;
    }
    
    toast.promise(
      async () => {
        await saveContent(localContent);
        setIsDirty(false);
      },
      {
        loading: "Saving document...",
        success: "Document saved successfully",
        error: "Failed to save document"
      }
    );
  };

  const handleRefresh = () => {
    console.log("Index: Refresh button clicked");
    
    // If there are unsaved changes, confirm before refreshing
    if (isDirty) {
      if (!confirm("You have unsaved changes. Refresh will discard them. Continue?")) {
        return;
      }
    }
    
    toast.promise(
      async () => {
        await refreshContent();
        setIsDirty(false);
      },
      {
        loading: "Refreshing document...",
        success: "Document refreshed",
        error: "Failed to refresh document"
      }
    );
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
          <div className="fixed top-0 right-0 p-3 z-10 flex flex-col items-end gap-2 bg-white/80 backdrop-blur-sm rounded-bl-md">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSave} 
                disabled={isSaving || !isDirty}
                className="h-8 px-2.5 text-xs"
              >
                <Save 
                  className="h-3.5 w-3.5 mr-1" 
                />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="h-8 px-2.5 text-xs"
              >
                <RefreshCw 
                  className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} 
                />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>

              {isDirty && (
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                  Unsaved changes
                </Badge>
              )}
              
              {!isDirty && lastSaved && !isSaving && (
                <span className="text-xs text-gray-600">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          
          <TextEditor 
            content={loading ? "" : content}
            onChange={handleContentChange}
            value={localContent}
          />
        </>
      )}
    </div>
  );
};

export default Index;
