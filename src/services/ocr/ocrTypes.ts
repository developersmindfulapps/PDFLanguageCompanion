/**
 * Type definitions for OCR (Optical Character Recognition) services and results.
 */

export interface OCRBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRWord {
  text: string;
  bbox: OCRBoundingBox;
  confidence: number;
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
  words: OCRWord[];
  confidence: number;
  imageWidth: number;
  imageHeight: number;
}

export interface OCRProgress {
  status: string;
  progress: number; // 0.0 to 1.0
}

export type OCRStatus =
  | 'idle'
  | 'initializing'
  | 'recognizing'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface RecognizeOptions {
  onProgress?: (progress: OCRProgress) => void;
  signal?: AbortSignal;
}

export class OCRCancelledError extends Error {
  constructor(message = 'OCR operation was cancelled') {
    super(message);
    this.name = 'OCRCancelledError';
  }
}
