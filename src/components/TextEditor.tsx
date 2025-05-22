
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface TextEditorProps {
  content: string;
  onChange: (content: string) => void;
  isLocalUpdate?: boolean;
}

const TextEditor = ({ content, onChange, isLocalUpdate = false }: TextEditorProps) => {
  const [localContent, setLocalContent] = useState(content);
  // Increase debounce time for more reliable saves
  const debouncedContent = useDebounce(localContent, 300);
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);
  const lastCursorPosition = useRef<{ start: number, end: number } | null>(null);
  const contentVersionRef = useRef<number>(0);
  
  // Store cursor position before updating content
  const saveCursorPosition = () => {
    if (document.activeElement !== editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;
    
    try {
      // Calculate cursor positions relative to the editor content
      const range = selection.getRangeAt(0);
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(editorRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const start = preSelectionRange.toString().length;
      
      const end = start + range.toString().length;
      lastCursorPosition.current = { start, end };
      
      console.log("Saved cursor position:", lastCursorPosition.current);
    } catch (e) {
      console.warn("Failed to save cursor position:", e);
    }
  };
  
  // Restore cursor position after updating content
  const restoreCursorPosition = () => {
    if (!lastCursorPosition.current || !editorRef.current) return;
    
    // Only restore if editor has focus
    if (document.activeElement !== editorRef.current) return;
    
    console.log("Attempting to restore cursor position:", lastCursorPosition.current);
    
    try {
      const selection = window.getSelection();
      if (!selection) return;
      
      // Find the position to place the cursor
      const { start, end } = lastCursorPosition.current;
      
      // Create a walker to find the correct text node and offset
      let currentPos = 0;
      let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
      
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      // Find start position
      let node;
      while ((node = walker.nextNode())) {
        const nodeLength = node.nodeValue?.length || 0;
        if (currentPos + nodeLength >= start) {
          startNode = node;
          startOffset = start - currentPos;
          break;
        }
        currentPos += nodeLength;
      }
      
      // Find end position
      currentPos = 0;
      walker.currentNode = editorRef.current;
      while ((node = walker.nextNode())) {
        const nodeLength = node.nodeValue?.length || 0;
        if (currentPos + nodeLength >= end) {
          endNode = node;
          endOffset = end - currentPos;
          break;
        }
        currentPos += nodeLength;
      }
      
      // Set selection to saved position
      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (e) {
      console.warn("Could not restore cursor position:", e);
    }
  };
  
  // Update local content when content prop changes (from other users)
  useEffect(() => {
    if (isLocalUpdate || isProcessingUpdate || isComposing) {
      console.log("Skipping external update during local edit or composition");
      return;
    }
    
    if (content !== localContent) {
      console.log("Applying external update from props:", content);
      setIsProcessingUpdate(true);
      
      // Save cursor position before changing content
      saveCursorPosition();
      
      // Set the content
      setLocalContent(content);
      
      // Update DOM directly to ensure consistency
      if (editorRef.current) {
        editorRef.current.innerText = content;
      }
      
      // Clear processing flag after a longer delay
      setTimeout(() => {
        // Increased delay from 10ms to 50ms for more reliable cursor restoration
        restoreCursorPosition();
        setIsProcessingUpdate(false);
      }, 50);
    }
  }, [content, localContent, isComposing, isLocalUpdate, isProcessingUpdate]);

  // Send debounced content updates to parent
  useEffect(() => {
    if (isProcessingUpdate || isComposing) {
      console.log("Skipping debounced update during processing or composition");
      return;
    }
    
    console.log("Debounced content update triggered");
    if (debouncedContent !== content) {
      console.log("Sending update to parent", debouncedContent.substring(0, 50));
      // Increment content version when sending updates
      contentVersionRef.current += 1;
      onChange(debouncedContent);
    }
  }, [debouncedContent, onChange, content, isProcessingUpdate, isComposing]);

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
    if (isProcessingUpdate) {
      console.log("Skipping input during processing");
      return;
    }
    
    // Save cursor position
    saveCursorPosition();
    
    try {
      // Get the actual text content instead of innerHTML
      const newContent = e.currentTarget.innerText;
      console.log("Text input detected, length:", newContent.length);
      setLocalContent(newContent);
    } catch (e) {
      console.error("Error handling input:", e);
    }
  };

  // Composition events are used for IME (Input Method Editor) input like for Asian languages
  const handleCompositionStart = () => {
    console.log("Composition started");
    setIsComposing(true);
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
    console.log("Composition ended");
    // Make sure we have the final text after composition ends
    if (e.currentTarget) {
      const finalText = e.currentTarget.innerText;
      setLocalContent(finalText);
    }
    
    // Small delay to ensure content is processed before allowing new updates
    setTimeout(() => {
      setIsComposing(false);
    }, 50); // Increased from 10ms to 50ms
  };

  // Handle focus and blur events to manage cursor position
  const handleFocus = () => {
    console.log("Editor focused");
  };
  
  const handleBlur = () => {
    console.log("Editor blurred, saving cursor position");
    saveCursorPosition();
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
