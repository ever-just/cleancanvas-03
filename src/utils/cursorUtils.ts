
/**
 * Utility functions for cursor position handling in the text editor
 */

/**
 * Calculates and saves the current cursor position within an element
 * @param editorElement The contentEditable div element
 * @returns The cursor position as start and end offsets, or null if not calculable
 */
export const saveCursorPosition = (editorElement: HTMLDivElement | null): { start: number; end: number } | null => {
  if (!editorElement || document.activeElement !== editorElement) return null;
  
  const selection = window.getSelection();
  if (!selection) return null;
  
  try {
    // Calculate cursor positions relative to the editor content
    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(editorElement);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    
    const end = start + range.toString().length;
    console.log("Saved cursor position:", { start, end });
    return { start, end };
  } catch (e) {
    console.warn("Failed to save cursor position:", e);
    return null;
  }
};

/**
 * Restores cursor position in an editable element
 * @param editorElement The contentEditable div element
 * @param position The position to restore to (start and end offsets)
 * @returns boolean indicating success
 */
export const restoreCursorPosition = (
  editorElement: HTMLDivElement | null, 
  position: { start: number; end: number } | null
): boolean => {
  if (!position || !editorElement) return false;
  
  // Only restore if editor has focus
  if (document.activeElement !== editorElement) return false;
  
  console.log("Attempting to restore cursor position:", position);
  
  try {
    const selection = window.getSelection();
    if (!selection) return false;
    
    // Find the position to place the cursor
    const { start, end } = position;
    
    // Create a walker to find the correct text node and offset
    let currentPos = 0;
    let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
    
    const walker = document.createTreeWalker(
      editorElement,
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
    walker.currentNode = editorElement;
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
      return true;
    }
    
    return false;
  } catch (e) {
    console.warn("Could not restore cursor position:", e);
    return false;
  }
};

/**
 * Safely updates content in a contentEditable element while preserving cursor position
 * @param editorElement The contentEditable div element
 * @param newContent The new content to set
 * @returns void
 */
export const updateContentPreservingCursor = (
  editorElement: HTMLDivElement | null,
  newContent: string
): void => {
  if (!editorElement) return;
  
  // Save cursor position before updating content
  const cursorPosition = saveCursorPosition(editorElement);
  
  // Update content
  editorElement.innerText = newContent;
  
  // Restore cursor position after a small delay to allow DOM updates
  setTimeout(() => {
    restoreCursorPosition(editorElement, cursorPosition);
  }, 50);
};
