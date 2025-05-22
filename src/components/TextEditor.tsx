
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface TextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const TextEditor = ({ content, onChange }: TextEditorProps) => {
  const [localContent, setLocalContent] = useState(content);
  const debouncedContent = useDebounce(localContent, 500);
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Update local content when content prop changes (from other users)
  useEffect(() => {
    if (content !== localContent) {
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
  }, [content]);

  // Send debounced content updates to parent
  useEffect(() => {
    if (debouncedContent !== content) {
      onChange(debouncedContent);
    }
  }, [debouncedContent, onChange, content]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    setLocalContent(e.currentTarget.innerHTML);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div
        ref={editorRef}
        contentEditable="true"
        suppressContentEditableWarning={true}
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: localContent }}
        className={cn(
          "min-h-screen w-full p-8 md:p-16 lg:p-24 outline-none",
          "bg-white text-black",
          "font-sans text-base md:text-lg leading-relaxed",
          "focus:outline-none whitespace-pre-wrap break-words"
        )}
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
          maxWidth: "100%",
        }}
      />
    </div>
  );
};

export default TextEditor;
