
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface TextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const TextEditor = ({ content, onChange }: TextEditorProps) => {
  const [localContent, setLocalContent] = useState(content);
  // Reduce debounce time from 500ms to 300ms for more responsive saves
  const debouncedContent = useDebounce(localContent, 300);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  
  // Update local content when content prop changes (from other users)
  useEffect(() => {
    if (content !== localContent && !isComposing) {
      console.log("Updating local content from props:", content);
      setLocalContent(content);
      
      // Set cursor position to the end if the editor has focus
      if (document.activeElement === editorRef.current) {
        const selection = window.getSelection();
        if (editorRef.current && selection) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false); // collapse to end
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }, [content, localContent, isComposing]);

  // Send debounced content updates to parent
  useEffect(() => {
    console.log("Debounced content update triggered");
    if (debouncedContent !== content) {
      console.log("Sending update to parent", debouncedContent.substring(0, 50));
      onChange(debouncedContent);
    }
  }, [debouncedContent, onChange, content]);

  // Initialize editor content on first render and when content changes
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerText) {
      console.log("Setting initial content in editor");
      // Only update DOM if content is different from what's displayed
      editorRef.current.innerText = content;
    }
  }, [content]);

  // Force a save when the component unmounts
  useEffect(() => {
    return () => {
      console.log("Editor unmounting, forcing save");
      if (localContent !== content) {
        onChange(localContent);
      }
    };
  }, [localContent, content, onChange]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Get the actual text content instead of innerHTML
    const newContent = e.currentTarget.innerText;
    console.log("Text input detected, length:", newContent.length);
    setLocalContent(newContent);
  };

  // Composition events are used for IME (Input Method Editor) input like for Asian languages
  const handleCompositionStart = () => {
    console.log("Composition started");
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    console.log("Composition ended");
    setIsComposing(false);
    // Make sure we have the final text after composition ends
    if (e.currentTarget) {
      const finalText = e.currentTarget.innerText;
      setLocalContent(finalText);
    }
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
