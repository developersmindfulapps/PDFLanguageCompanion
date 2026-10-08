import React, { useEffect, useRef } from 'react';
import type { PDFPageProxy, TextContentItem } from '../types/pdf';
import type { WordSelection } from '../types/selection';
import { pdfService } from '../services/pdfService';
import { useWordSelection } from '../hooks/useWordSelection';

interface TextLayerProps {
  page: PDFPageProxy;
  scale: number;
  onHasTextChange?: (hasText: boolean) => void;
  onWordSelected?: (selection: WordSelection | null) => void;
}

export const TextLayer: React.FC<TextLayerProps> = ({
  page,
  scale,
  onHasTextChange,
  onWordSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRenderRef = useRef<(() => void) | null>(null);

  // Hook into word selection and click detection
  useWordSelection({
    containerRef,
    pageNumber: page.pageNumber,
    onWordSelected,
    enabled: true,
  });

  useEffect(() => {
    let isCancelled = false;
    const container = containerRef.current;
    if (!container) return;

    // Cancel any previous in-flight text layer render
    if (cancelRenderRef.current) {
      cancelRenderRef.current();
      cancelRenderRef.current = null;
    }

    // Clear previous DOM nodes immediately
    container.innerHTML = '';

    async function loadAndRenderText() {
      try {
        const textContent = await pdfService.getTextContent(page);
        if (isCancelled || !container) return;

        // Check if page contains meaningful text content
        const hasText = textContent.items.some(
          (item: TextContentItem) => 'str' in item && typeof item.str === 'string' && item.str.trim().length > 0
        );

        onHasTextChange?.(hasText);

        if (!hasText) {
          container.innerHTML = '';
          return;
        }

        const viewport = page.getViewport({ scale });
        const renderHandle = pdfService.renderTextLayer(textContent, container, viewport);
        cancelRenderRef.current = renderHandle.cancel;

        await renderHandle.promise;
      } catch (err) {
        if (!isCancelled) {
          console.warn('Text layer extraction/render error:', err);
          onHasTextChange?.(false);
        }
      }
    }

    loadAndRenderText();

    return () => {
      isCancelled = true;
      if (cancelRenderRef.current) {
        cancelRenderRef.current();
        cancelRenderRef.current = null;
      }
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [page, scale, onHasTextChange]);

  return (
    <div
      ref={containerRef}
      className="textLayer"
      aria-hidden="true"
    />
  );
};
