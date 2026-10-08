import * as pdfjsLib from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
  PageViewport,
  TextContent,
} from './../types/pdf';

// Configure PDF.js worker
function initWorker() {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }
}

/**
 * Resolves the CMap URL for the current environment.
 *
 * In a Chrome Extension, CMaps MUST be served from a local extension URL
 * (chrome-extension://...) because Manifest V3 CSP blocks remote CDN fetches
 * (e.g. cdn.jsdelivr.net) at the extension page level. When CMaps can't load,
 * PDF.js silently returns empty `str` values for CID-font-encoded text, which
 * causes real textbook PDFs to be incorrectly classified as scanned/image-only.
 *
 * CMaps are bundled into `public/cmaps/` (copied from `node_modules/pdfjs-dist/cmaps/`)
 * and are therefore always available locally at `chrome.runtime.getURL('cmaps/')`.
 */
function resolveCMapUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL('cmaps/');
    } catch {
      // Fallback: dev server serves from root
    }
  }
  return '/cmaps/';
}

/**
 * Resolves the standard fonts directory URL for the current environment.
 * Bundled locally in `public/standard_fonts/` to ensure offline font rendering
 * without remote fetches or font warnings.
 */
function resolveStandardFontDataUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    try {
      return chrome.runtime.getURL('standard_fonts/');
    } catch {
      // Fallback: dev server serves from root
    }
  }
  return '/standard_fonts/';
}

initWorker();

export class PDFService {
  private static instance: PDFService;
  private currentDoc: PDFDocumentProxy | null = null;

  private constructor() {
    initWorker();
  }

  public static getInstance(): PDFService {
    if (!PDFService.instance) {
      PDFService.instance = new PDFService();
    }
    return PDFService.instance;
  }

  /**
   * Loads a PDF document from a File or ArrayBuffer.
   */
  public async loadDocument(data: File | ArrayBuffer): Promise<PDFDocumentProxy> {
    // Clean up previous document if one exists
    await this.cleanupCurrentDocument();

    let buffer: ArrayBuffer;
    if (data instanceof File) {
      buffer = await data.arrayBuffer();
    } else {
      buffer = data;
    }

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        // CMaps and standard fonts are bundled locally in public/ — do NOT use a remote CDN.
        // In Chrome Extension MV3, CDN requests are blocked by CSP.
        cMapUrl: resolveCMapUrl(),
        cMapPacked: true,
        standardFontDataUrl: resolveStandardFontDataUrl(),
      });

      const doc = await loadingTask.promise;
      this.currentDoc = doc;
      return doc;
    } catch (error) {
      console.error('Failed to load PDF document:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Invalid or corrupted PDF file.'
      );
    }
  }

  /**
   * Retrieves a specific page from the document (1-indexed).
   */
  public async getPage(doc: PDFDocumentProxy, pageNumber: number): Promise<PDFPageProxy> {
    if (pageNumber < 1 || pageNumber > doc.numPages) {
      throw new Error(`Invalid page number: ${pageNumber}. Document has ${doc.numPages} pages.`);
    }
    return await doc.getPage(pageNumber);
  }

  /**
   * Renders a PDF page to an HTML canvas element.
   * Handles device pixel ratio for sharp rendering on high-DPI displays.
   */
  public renderPage(
    page: PDFPageProxy,
    canvas: HTMLCanvasElement,
    scale: number
  ): { promise: Promise<void>; cancel: () => void } {
    const viewport = page.getViewport({ scale });

    const pixelRatio = window.devicePixelRatio || 1;
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) {
      throw new Error('Could not get 2D canvas context.');
    }

    // Set internal canvas resolution scaled by device pixel ratio
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);

    // Set CSS display dimensions
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    // Transform context to handle retina scale
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const renderContext = {
      canvasContext: context,
      viewport,
    };

    let renderTask: RenderTask | null = page.render(renderContext);

    const promise = renderTask.promise
      .then(() => {
        renderTask = null;
      })
      .catch((err: unknown) => {
        // Suppress cancelled render error
        if (
          err &&
          typeof err === 'object' &&
          'name' in err &&
          (err as { name: string }).name === 'RenderingCancelledException'
        ) {
          return;
        }
        throw err;
      });

    return {
      promise,
      cancel: () => {
        if (renderTask) {
          try {
            renderTask.cancel();
          } catch {
            // Ignore cancel errors
          }
        }
      },
    };
  }

  /**
   * Extracts text content from a page.
   */
  public async getTextContent(page: PDFPageProxy): Promise<TextContent> {
    return await page.getTextContent();
  }

  /**
   * Renders the text layer for a page into a container element.
   */
  public renderTextLayer(
    textContent: TextContent,
    container: HTMLElement,
    viewport: PageViewport
  ): { promise: Promise<void>; cancel: () => void } {
    container.innerHTML = '';
    container.style.setProperty('--scale-factor', `${viewport.scale}`);
    container.style.width = `${Math.floor(viewport.width)}px`;
    container.style.height = `${Math.floor(viewport.height)}px`;

    const textLayerInstance = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container,
      viewport,
    });

    let isCancelled = false;

    const promise = textLayerInstance.render().catch((err: unknown) => {
      if (isCancelled) return;
      console.warn('TextLayer render error:', err);
    });

    return {
      promise,
      cancel: () => {
        isCancelled = true;
        try {
          textLayerInstance.cancel();
        } catch {
          // Ignore cancel error
        }
      },
    };
  }

  /**
   * Cleans up the active PDF document resources to prevent memory leaks.
   */
  public async cleanupCurrentDocument(): Promise<void> {
    if (this.currentDoc) {
      try {
        await this.currentDoc.destroy();
      } catch (err) {
        console.warn('Error destroying PDF document:', err);
      }
      this.currentDoc = null;
    }
  }
}

export const pdfService = PDFService.getInstance();
