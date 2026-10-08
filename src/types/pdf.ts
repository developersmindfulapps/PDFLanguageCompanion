import type {
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist';

export type { PDFDocumentProxy, PDFPageProxy, RenderTask };

export type PageViewport = ReturnType<PDFPageProxy['getViewport']>;
export type TextContent = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;
export type TextContentItem = TextContent['items'][number];

export interface PDFDocumentInfo {
  numPages: number;
  fileName: string;
  fileSize?: number;
}

export type ZoomMode = 'fit-width' | 'custom';

export interface ZoomState {
  scale: number;
  mode: ZoomMode;
}

export interface PageViewportDimensions {
  width: number;
  height: number;
}

export interface PDFLoadError {
  title: string;
  message: string;
}
