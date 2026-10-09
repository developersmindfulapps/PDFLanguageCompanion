import React, { useRef, useMemo } from 'react';
import type { OCRPageResult } from '../services/ocr/ocrTypes.ts';
import type { PageViewport, PDFPageProxy } from '../types/pdf.ts';
import type { WordSelection } from '../types/selection.ts';
import { useWordSelection } from '../hooks/useWordSelection.ts';
import { normalizeBoundingBox, projectToViewport } from '../services/ocr/ocrUtils.ts';

interface OCRTextLayerProps {
  ocrResult: OCRPageResult;
  pageNumber: number;
  viewport?: PageViewport;
  page?: PDFPageProxy;
  scale?: number;
  onWordSelected?: (selection: WordSelection | null) => void;
}

// Reusable canvas context for measuring unscaled text widths
let measureCanvasContext: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvasContext) {
    const canvas = document.createElement('canvas');
    measureCanvasContext = canvas.getContext('2d');
  }
  return measureCanvasContext;
}

export const OCRTextLayer: React.FC<OCRTextLayerProps> = ({
  ocrResult,
  pageNumber,
  viewport,
  page,
  scale = 1.0,
  onWordSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Hook into word selection in 'selection-only' mode for OCR
  useWordSelection({
    containerRef,
    pageNumber,
    onWordSelected,
    enabled: true,
    mode: 'selection-only',
  });

  // Calculate effective viewport dimensions in CSS display pixels
  const effectiveViewport = useMemo(() => {
    if (viewport) {
      return { width: Math.floor(viewport.width), height: Math.floor(viewport.height) };
    }
    if (page) {
      const vp = page.getViewport({ scale });
      return { width: Math.floor(vp.width), height: Math.floor(vp.height) };
    }
    return { width: ocrResult.imageWidth, height: ocrResult.imageHeight };
  }, [viewport, page, scale, ocrResult.imageWidth, ocrResult.imageHeight]);

  const viewportWidth = effectiveViewport.width;
  const viewportHeight = effectiveViewport.height;

  // Precompute word projections, font sizes, and horizontal scaleX factors
  const wordSpans = useMemo(() => {
    const ctx = getMeasureContext();

    return ocrResult.words.map((word, idx) => {
      const norm = normalizeBoundingBox(
        word.bbox,
        ocrResult.imageWidth,
        ocrResult.imageHeight
      );
      const proj = projectToViewport(norm, viewportWidth, viewportHeight);
      const fontSize = Math.max(Math.round(proj.height * 0.85), 8);

      let scaleX = 1;
      if (ctx && proj.width > 0) {
        ctx.font = `${fontSize}px sans-serif`;
        const naturalWidth = ctx.measureText(word.text).width;
        if (naturalWidth > 0) {
          scaleX = proj.width / naturalWidth;
        }
      }

      return {
        key: `ocr-word-${idx}-${word.text}`,
        text: word.text,
        idx,
        left: proj.left,
        top: proj.top,
        width: proj.width,
        height: proj.height,
        fontSize,
        scaleX: Math.round(scaleX * 1000) / 1000,
      };
    });
  }, [ocrResult, viewportWidth, viewportHeight]);

  return (
    <div
      ref={containerRef}
      className="textLayer ocrTextLayer"
      style={{
        width: `${viewportWidth}px`,
        height: `${viewportHeight}px`,
      }}
      aria-hidden="true"
    >
      {wordSpans.map((span) => (
        <span
          key={span.key}
          data-ocr-word={span.text}
          data-ocr-index={span.idx}
          style={{
            position: 'absolute',
            left: `${span.left}px`,
            top: `${span.top}px`,
            width: `${span.width}px`,
            height: `${span.height}px`,
            fontSize: `${span.fontSize}px`,
            lineHeight: `${span.height}px`,
            fontFamily: 'sans-serif',
            transform: `scaleX(${span.scaleX})`,
            transformOrigin: '0 0',
            whiteSpace: 'pre',
            userSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        >
          {span.text}
        </span>
      ))}
    </div>
  );
};
