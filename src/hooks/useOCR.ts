import { useState, useCallback, useRef, useEffect } from 'react';
import { ocrService } from '../services/ocr/ocrService.ts';
import { type OCRPageResult, type OCRProgress, OCRCancelledError } from '../services/ocr/ocrTypes.ts';

export interface UseOCROptions {
  currentPage: number;
}

export function useOCR({ currentPage }: UseOCROptions) {
  const [pageCache, setPageCache] = useState<Map<number, OCRPageResult>>(() => new Map());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<OCRProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeJobPageRef = useRef<number | null>(null);

  // Retrieve cached OCR result for the currently active page
  const currentOCRResult = pageCache.get(currentPage) || null;

  // Automatically cancel in-flight OCR job when navigating to another page
  useEffect(() => {
    if (isProcessing && activeJobPageRef.current !== null && activeJobPageRef.current !== currentPage) {
      ocrService.cancel();
      setIsProcessing(false);
      setProgress(null);
      setError(null);
      activeJobPageRef.current = null;
    }
  }, [currentPage, isProcessing]);

  /**
   * Triggers OCR recognition on the provided canvas for a specific page number.
   */
  const runOCR = useCallback(
    async (canvas: HTMLCanvasElement | null, pageNumber = currentPage) => {
      if (!canvas) {
        setError('Page canvas is not available for OCR.');
        return;
      }

      // Check if result is already in memory cache
      if (pageCache.has(pageNumber)) {
        return;
      }

      setIsProcessing(true);
      setProgress({ status: 'Starting OCR...', progress: 0 });
      setError(null);
      activeJobPageRef.current = pageNumber;

      try {
        const result = await ocrService.recognize(canvas, pageNumber, {
          onProgress: (p) => {
            if (activeJobPageRef.current === pageNumber) {
              setProgress(p);
            }
          },
        });

        // Store result in memory cache
        setPageCache((prev) => {
          const next = new Map(prev);
          next.set(pageNumber, result);
          return next;
        });

        if (activeJobPageRef.current === pageNumber) {
          setIsProcessing(false);
          setProgress(null);
          activeJobPageRef.current = null;
        }
      } catch (err) {
        if (err instanceof OCRCancelledError) {
          // Operation was cancelled cleanly by user or page navigation
          setIsProcessing(false);
          setProgress(null);
          activeJobPageRef.current = null;
        } else {
          console.error('OCR recognition error:', err);
          if (activeJobPageRef.current === pageNumber) {
            setError(
              err instanceof Error
                ? err.message
                : 'Failed to recognize text on this page.'
            );
            setIsProcessing(false);
            setProgress(null);
            activeJobPageRef.current = null;
          }
        }
      }
    },
    [currentPage, pageCache]
  );

  /**
   * Cancels any currently running OCR recognition.
   */
  const cancelOCR = useCallback(() => {
    ocrService.cancel();
    setIsProcessing(false);
    setProgress(null);
    activeJobPageRef.current = null;
  }, []);

  /**
   * Clears the entire OCR page cache and terminates the background worker.
   * Invoked when closing or replacing the active PDF document.
   */
  const clearCache = useCallback(async () => {
    ocrService.cancel();
    setPageCache(new Map());
    setIsProcessing(false);
    setProgress(null);
    setError(null);
    activeJobPageRef.current = null;
    await ocrService.terminate();
  }, []);

  return {
    currentOCRResult,
    isProcessing,
    progress,
    error,
    runOCR,
    cancelOCR,
    clearCache,
    hasCachedResult: (page: number) => pageCache.has(page),
    cachedPagesCount: pageCache.size,
  };
}
