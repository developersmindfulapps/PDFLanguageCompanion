import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy, PDFPageProxy, ZoomState } from '../types/pdf';
import type { WordSelection } from '../types/selection';
import { pdfService } from '../services/pdfService';
import { LoadingSpinner } from './LoadingSpinner';
import { TextLayer } from './TextLayer';
import { EmptyTextWarning } from './EmptyTextWarning';

interface PDFViewerProps {
  doc: PDFDocumentProxy;
  currentPage: number;
  zoom: ZoomState;
  onPageChange: (newPage: number) => void;
  onZoomChange: (newZoom: ZoomState) => void;
  onLoadingStateChange: (isLoading: boolean) => void;
  onWordSelected?: (selection: WordSelection | null) => void;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  doc,
  currentPage,
  zoom,
  onPageChange,
  onZoomChange,
  onLoadingStateChange,
  onWordSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<PDFPageProxy | null>(null);
  const [currentScale, setCurrentScale] = useState<number>(zoom.scale);
  const [hasTextContent, setHasTextContent] = useState<boolean | null>(null);

  const cancelRenderRef = useRef<(() => void) | null>(null);

  // Calculate fit-to-width scale if required
  const calculateEffectiveScale = useCallback(
    (page: PDFPageProxy): number => {
      if (zoom.mode === 'custom') {
        return zoom.scale;
      }

      if (!containerRef.current) {
        return zoom.scale;
      }

      const unscaledViewport = page.getViewport({ scale: 1.0 });
      // Leave 48px padding (24px each side)
      const containerWidth = containerRef.current.clientWidth - 48;
      if (containerWidth <= 0) {
        return zoom.scale;
      }

      const fitScale = Math.min(Math.max(containerWidth / unscaledViewport.width, 0.4), 2.5);
      return fitScale;
    },
    [zoom.mode, zoom.scale]
  );

  // Render current page canvas and update active page
  useEffect(() => {
    let isCancelled = false;

    async function loadAndRender() {
      if (!canvasRef.current || !doc) return;

      setIsRendering(true);
      onLoadingStateChange(true);
      setRenderError(null);

      // Cancel any previous in-flight render task
      if (cancelRenderRef.current) {
        cancelRenderRef.current();
        cancelRenderRef.current = null;
      }

      try {
        const page = await pdfService.getPage(doc, currentPage);
        if (isCancelled) return;

        setActivePage(page);
        const effectiveScale = calculateEffectiveScale(page);
        setCurrentScale(effectiveScale);

        // Update zoom scale state if fit-width computed a new scale
        if (zoom.mode === 'fit-width' && Math.abs(zoom.scale - effectiveScale) > 0.01) {
          onZoomChange({ scale: effectiveScale, mode: 'fit-width' });
        }

        const renderHandle = pdfService.renderPage(page, canvasRef.current, effectiveScale);
        cancelRenderRef.current = renderHandle.cancel;

        await renderHandle.promise;

        if (!isCancelled) {
          setIsRendering(false);
          onLoadingStateChange(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error rendering page:', err);
          setRenderError(err instanceof Error ? err.message : 'Error rendering page.');
          setIsRendering(false);
          onLoadingStateChange(false);
        }
      }
    }

    loadAndRender();

    return () => {
      isCancelled = true;
      if (cancelRenderRef.current) {
        cancelRenderRef.current();
        cancelRenderRef.current = null;
      }
    };
  }, [doc, currentPage, zoom.scale, zoom.mode, calculateEffectiveScale, onZoomChange, onLoadingStateChange]);

  // Reset text content presence check when changing pages
  useEffect(() => {
    setHasTextContent(null);
  }, [currentPage, doc]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentPage > 1) onPageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        if (currentPage < doc.numPages) onPageChange(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, doc.numPages, onPageChange]);

  // Handle container resize in fit-width mode
  useEffect(() => {
    if (zoom.mode !== 'fit-width' || !containerRef.current) return;

    let resizeTimer: number;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (activePage) {
          const newScale = calculateEffectiveScale(activePage);
          if (Math.abs(zoom.scale - newScale) > 0.02) {
            onZoomChange({ scale: newScale, mode: 'fit-width' });
          }
        }
      }, 100);
    });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      window.clearTimeout(resizeTimer);
    };
  }, [zoom.mode, zoom.scale, activePage, calculateEffectiveScale, onZoomChange]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex-1 overflow-auto bg-slate-200/80 p-6 flex items-start justify-center focus:outline-none"
    >
      <div className="relative flex flex-col items-center">
        {/* Scanned / Image-only PDF Warning */}
        {hasTextContent === false && (
          <EmptyTextWarning className="mb-4 w-full max-w-lg animate-in fade-in duration-200" />
        )}

        {/* Page Container holding Canvas + TextLayer */}
        <div className="relative shadow-lg rounded-sm bg-white overflow-hidden transition-all duration-150">
          <canvas ref={canvasRef} className="block" />

          {/* Text Layer aligned 1:1 with Canvas */}
          {activePage && !isRendering && (
            <TextLayer
              page={activePage}
              scale={currentScale}
              onHasTextChange={setHasTextContent}
              onWordSelected={onWordSelected}
            />
          )}

          {/* Page Loading Overlay */}
          {isRendering && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center transition-opacity z-10">
              <LoadingSpinner message="Loading page..." size="sm" />
            </div>
          )}
        </div>

        {/* Render Error */}
        {renderError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {renderError}
          </div>
        )}
      </div>
    </div>
  );
};
