import { useEffect, useState, useCallback, useRef } from 'react';
import type { WordSelection } from '../types/selection';
import { cleanWordToken, isSingleWord, extractWordAtOffset } from '../utils/textUtils';

export type WordSelectionMode = 'click-or-select' | 'selection-only';

export interface UseWordSelectionOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  pageNumber: number;
  onWordSelected?: (selection: WordSelection | null) => void;
  enabled?: boolean;
  mode?: WordSelectionMode;
}

export function useWordSelection({
  containerRef,
  pageNumber,
  onWordSelected,
  enabled = true,
  mode = 'click-or-select',
}: UseWordSelectionOptions) {
  const [selectedWord, setSelectedWord] = useState<WordSelection | null>(null);
  const onWordSelectedRef = useRef(onWordSelected);
  onWordSelectedRef.current = onWordSelected;

  const setSelection = useCallback((sel: WordSelection | null) => {
    setSelectedWord(sel);
    onWordSelectedRef.current?.(sel);
  }, []);

  // Clear selection when pageNumber changes
  useEffect(() => {
    setSelection(null);
  }, [pageNumber, setSelection]);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseUp = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      // 1. Check if interaction happened inside the textLayer container
      const target = e.target as Node | null;
      if (!target || !container.contains(target)) {
        // Clicked outside textLayer
        if (selectedWord) {
          setSelection(null);
        }
        return;
      }

      const selection = window.getSelection();

      // 2. Check for drag-highlighted text selection
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        const rawText = selection.toString().trim();
        if (rawText) {
          try {
            const range = selection.getRangeAt(0);

            // In selection-only mode (OCR), ensure the selection represents exactly ONE complete OCR word
            if (mode === 'selection-only') {
              const getOcrWordElement = (node: Node | null): HTMLElement | null => {
                let curr: Node | null = node;
                while (curr && curr !== container) {
                  if (curr.nodeType === Node.ELEMENT_NODE && (curr as HTMLElement).hasAttribute('data-ocr-word')) {
                    return curr as HTMLElement;
                  }
                  curr = curr.parentNode;
                }
                return null;
              };

              const startEl = getOcrWordElement(range.startContainer);
              const endEl = getOcrWordElement(range.endContainer);

              // Multi-element selection or non-OCR element is rejected (multi-word selection suppression)
              if (!startEl || !endEl || startEl !== endEl) {
                setSelection(null);
                return;
              }

              // Multiword check on the selected text
              if (!isSingleWord(rawText)) {
                setSelection(null);
                return;
              }

              // In OCR mode, verify that the selection represents the COMPLETE word token.
              // Partial selections inside a word (e.g. "Lieblingsfil" or "film" inside "Lieblingsfilm") are strictly rejected.
              const fullOcrText = startEl.getAttribute('data-ocr-word') || startEl.textContent || '';
              const fullCleaned = cleanWordToken(fullOcrText);
              const selectedCleaned = cleanWordToken(rawText);

              if (!fullCleaned || !selectedCleaned || selectedCleaned.toLowerCase() !== fullCleaned.toLowerCase()) {
                setSelection(null);
                return;
              }

              const spanRect = startEl.getBoundingClientRect();
              if (spanRect && spanRect.width > 0 && spanRect.height > 0) {
                setSelection({
                  word: fullCleaned,
                  pageNumber,
                  rect: spanRect,
                });
                return;
              }
            } else if (isSingleWord(rawText)) {
              // Normal text-PDF selection mode
              const cleaned = cleanWordToken(rawText);
              if (cleaned) {
                const rect = range.getBoundingClientRect();
                const validRect = rect.width > 0 && rect.height > 0;
                const fallbackRect = range.startContainer.parentElement?.getBoundingClientRect();
                const finalRect = validRect ? rect : fallbackRect;

                if (finalRect && finalRect.width > 0 && finalRect.height > 0) {
                  setSelection({
                    word: cleaned,
                    pageNumber,
                    rect: finalRect,
                  });
                  return;
                }
              }
            } else {
              // Normal PDF multi-word selection: do not treat as single word
              setSelection(null);
              return;
            }
          } catch {
            // Ignore range rect error
          }
        }
      }

      // In selection-only mode (OCR), simple clicks must NEVER trigger a tooltip
      if (mode === 'selection-only') {
        setSelection(null);
        return;
      }

      // 3. Normal text-PDF mode: Check for single click at point
      let targetNode: Node | null = null;
      let targetOffset = 0;

      // Modern caret position lookup
      if ('caretPositionFromPoint' in document) {
        // Standard API
        const caretPos = (document as unknown as {
          caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
        }).caretPositionFromPoint(e.clientX, e.clientY);
        if (caretPos) {
          targetNode = caretPos.offsetNode;
          targetOffset = caretPos.offset;
        }
      } else if ('caretRangeFromPoint' in document) {
        // WebKit fallback
        const range = (document as unknown as {
          caretRangeFromPoint: (x: number, y: number) => Range | null;
        }).caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          targetNode = range.startContainer;
          targetOffset = range.startOffset;
        }
      }

      // Fallback: If clicked element itself has text nodes
      if (!targetNode && target && target.nodeType === Node.TEXT_NODE) {
        targetNode = target;
        targetOffset = 0;
      } else if (!targetNode && target && target.childNodes.length > 0) {
        const firstText = Array.from(target.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (firstText) {
          targetNode = firstText;
          targetOffset = 0;
        }
      }

      if (targetNode && targetNode.nodeType === Node.TEXT_NODE && targetNode.textContent) {
        const text = targetNode.textContent;
        const extracted = extractWordAtOffset(text, targetOffset);

        if (extracted && extracted.word) {
          try {
            const range = document.createRange();
            range.setStart(targetNode, extracted.startOffset);
            range.setEnd(targetNode, extracted.endOffset);
            const rect = range.getBoundingClientRect();

            // Fallback to parent span rect if range rect is collapsed
            const finalRect =
              rect.width > 0 && rect.height > 0
                ? rect
                : (targetNode.parentElement?.getBoundingClientRect() ?? rect);

            setSelection({
              word: extracted.word,
              pageNumber,
              rect: finalRect,
            });
            return;
          } catch (err) {
            console.warn('Could not compute word bounding rect:', err);
          }
        }
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, pageNumber, enabled, mode, selectedWord, setSelection]);

  return {
    selectedWord,
    clearSelection: () => setSelection(null),
  };
}
