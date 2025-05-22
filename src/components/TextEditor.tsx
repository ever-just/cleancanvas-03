
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { saveCursorPosition, restoreCursorPosition } from "@/utils/cursorUtils";

interface TextEditorProps {
  content: string;
  onChange: (content: string) => void;
  value: string;
}

const TextEditor = ({ content, onChange, value }: TextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const lastCursorPosition = useRef<{ start: number, end: number } | null>(null);
  const isInitialMount = useRef(true);

  // Initialize editor content on first render
  useEffect(() => {
    if (isInitialMount.current && editorRef.current) {
      console.log("TextEditor: Initial content set on mount:", value.substring(0, 50));
      editorRef.current.innerText = value || content || '';
      isInitialMount.current = false;
    }
  }, [content, value]);

  // Update editor content when value prop changes (from parent)
  useEffect(() => {
    if (!isInitialMount.current && editorRef.current) {
      console.log("TextEditor: Value prop changed:", value.substring(0, 50));
      
      // Don't update if we're in the middle of composing (IME input)
      if (isComposing) {
        console.log("TextEditor: Skipping update during composition");
        return;
      }
      
      // Save cursor position before updating content
      lastCursorPosition.current = saveCursorPosition(editorRef.current);
      
      // Only update if the content is different
      if (editorRef.current.innerText !== value) {
        console.log("TextEditor: Updating editor content");
        editorRef.current.innerText = value || '';
        
        // Restore cursor position
        setTimeout(() => {
          restoreCursorPosition(editorRef.current, lastCursorPosition.current);
        }, 10);
      }
    }
  }, [value, isComposing]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (isComposing) {
      console.log("TextEditor: Input during composition, deferring update");
      return;
    }
    
    try {
      // Save cursor position
      lastCursorPosition.current = saveCursorPosition(editorRef.current);
      
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
    setTimeout(() => {
      if (e.currentTarget) {
        const finalText = e.currentTarget.innerText;
        onChange(finalText);
      }
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
