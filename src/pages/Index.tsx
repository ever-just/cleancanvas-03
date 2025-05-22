
import { useEffect, useState, useRef } from "react";
import TextEditor from "@/components/TextEditor";
import { useDocumentSync } from "@/hooks/useDocumentSync";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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

  const [timeUntilSave, setTimeUntilSave] = useState<number>(10);
  const [isDirty, setIsDirty] = useState(false);
  const lastTimeRef = useRef<number>(Date.now());

  // Update the countdown timer with more consistent timing
  useEffect(() => {
    let interval: number | null = null;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = (now - lastTimeRef.current) / 1000;
      const remaining = Math.max(0, 10 - elapsed);
      setTimeUntilSave(remaining);
      
      // If timer has expired and we have unsaved changes, save content
      if (remaining === 0 && isDirty) {
        handleContentChange(content);
      }
    };

    if (isDirty && !isSaving) {
      // Start the timer when content becomes dirty
      interval = window.setInterval(updateTimer, 500);
    }

    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isDirty, isSaving, content]);

  const handleContentChange = (newContent: string) => {
    console.log("Index: Content change triggered save");
    saveContent(newContent);
    setIsDirty(false);
  };

  const handleLocalChange = () => {
    console.log("Index: Local change detected, marking as dirty");
    setIsDirty(true);
    lastTimeRef.current = Date.now(); // Reset timer on local changes
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

  const progressValue = timeUntilSave ? (timeUntilSave / 10) * 100 : 0;

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
              {isDirty && (
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                  Unsaved changes
                </Badge>
              )}
              {isSaving ? (
                <span className="text-xs text-gray-600 flex items-center">
                  <span className="animate-pulse mr-1">●</span>
                  Saving...
                </span>
              ) : lastSaved ? (
                <span className="text-xs text-gray-600">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              ) : null}
            </div>
            
            {isDirty && !isSaving && (
              <div className="w-48">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Auto-save in {Math.ceil(timeUntilSave)}s</span>
                </div>
                <Progress value={progressValue} className="h-1" />
              </div>
            )}
          </div>
          
          <TextEditor 
            content={content} 
            onChange={handleContentChange} 
            onLocalChange={handleLocalChange}
            isLocalUpdate={isLocalUpdate}
          />
        </>
      )}
    </div>
  );
};

export default Index;
