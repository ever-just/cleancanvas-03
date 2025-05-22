
import { useEffect } from "react";
import TextEditor from "@/components/TextEditor";
import { useDocumentSync } from "@/hooks/useDocumentSync";

const Index = () => {
  const {
    content,
    loading,
    error,
    isSaving,
    lastSaved,
    isLocalUpdate,
    saveContent
  } = useDocumentSync({
    documentId: 'shared'
  });

  const handleContentChange = (newContent: string) => {
    saveContent(newContent);
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
            isLocalUpdate={isLocalUpdate}
          />
        </>
      )}
    </div>
  );
};

export default Index;
