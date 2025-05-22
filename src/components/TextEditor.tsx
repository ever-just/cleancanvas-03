
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { saveCursorPosition, restoreCursorPosition } from "@/utils/cursorUtils";

interface TextEditorProps {
  content: string;
  onChange: (content: string) => void;
  isLocalUpdate?: boolean;
}

const TextEditor = ({ content, onChange, isLocalUpdate = false }: TextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);
  const lastCursorPosition = useRef<{ start: number, end: number } | null>(null);
  const isInitialMount = useRef(true);

  // Handle external content updates (from other users or refresh)
  useEffect(() => {
    if (isLocalUpdate || isProcessingUpdate || isComposing) {
      console.log("TextEditor: Skipping external update during local edit or composition");
      return;
    }
    
    console.log("TextEditor: Applying external update:", content.substring(0, 50));
    setIsProcessingUpdate(true);
    
    // Save cursor position before changing content
    lastCursorPosition.current = saveCursorPosition(editorRef.current);
    
    // Directly update the DOM for consistency
    if (editorRef.current) {
      editorRef.current.innerText = content;
    }
    
    // Adaptive timing based on content size for more reliable cursor restoration
    const contentSize = content.length;
    const restorationDelay = Math.min(100 + Math.floor(contentSize / 1000), 300);
    
    // Restore cursor position after a delay
    setTimeout(() => {
      restoreCursorPosition(editorRef.current, lastCursorPosition.current);
      setIsProcessingUpdate(false);
    }, restorationDelay);
  }, [content, isLocalUpdate, isProcessingUpdate, isComposing]);

  // Ensure content is properly initialized on mount
  useEffect(() => {
    if (isInitialMount.current && editorRef.current) {
      console.log("TextEditor: Initial content set");
      editorRef.current.innerText = content;
      isInitialMount.current = false;
    }
  }, [content]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isProcessingUpdate) {
      console.log("TextEditor: Skipping input during processing");
      return;
    }
    
    // Save cursor position
    lastCursorPosition.current = saveCursorPosition(editorRef.current);
    
    try {
      // Get the actual text content
      const newContent = e.currentTarget.innerText;
      console.log("TextEditor: Input detected, length:", newContent.length);
      
      // Notify parent of content change
      onChange(newContent);
    } catch (e) {
      console.error("TextEditor: Error handling input:", e);
    }
  };

  // Composition events for IME input (Asian languages, etc.)
  const handleCompositionStart = () => {
    console.log("TextEditor: Composition started");
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    console.log("TextEditor: Composition ended");
    
    // Make sure we have the final text after composition ends
    if (e.currentTarget) {
      const finalText = e.currentTarget.innerText;
      onChange(finalText);
    }
    
    // Small delay to ensure content is processed before allowing new updates
    setTimeout(() => {
      setIsComposing(false);
    }, 100);
  };

  // Handle focus and blur events
  const handleFocus = () => {
    console.log("TextEditor: Editor focused");
  };
  
  const handleBlur = () => {
    console.log("TextEditor: Editor blurred, saving cursor position");
    lastCursorPosition.current = saveCursorPosition(editorRef.current);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div
        ref={editorRef}
        contentEditable="true"
        suppressContentEditableWarning={true}
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "min-h-screen w-full p-8 md:p-16 lg:p-24 outline-none",
          "bg-white text-black",
          "font-sans text-base md:text-lg leading-relaxed",
          "focus:outline-none whitespace-pre-wrap break-words"
        )}
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
          maxWidth: "100%",
          direction: "ltr", // Explicitly set text direction to left-to-right
          unicodeBidi: "normal", // Ensure normal Unicode bidirectional algorithm processing
          textAlign: "left" // Ensure text aligns from left
        }}
      />
    </div>
  );
};

export default TextEditor;
